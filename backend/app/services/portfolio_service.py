import math
import logging
import threading
import time
from bisect import bisect_right
from datetime import date, datetime, timedelta, timezone
from itertools import pairwise
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.holdings_repository import HoldingsRepository
from app.repositories.news_repository import NewsRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.instruments import (
    INVALID_TICKER_MARKERS,
    KIND_ETF,
    KIND_STOCK,
    REGION_BENCHMARKS,
    REGION_SA,
    REGION_UNKNOWN,
    get_look_through_note,
    is_region_benchmark,
    is_zar_listed,
    looks_like_fund,
    normalize_sector,
    quote_currency,
    resolve_known_instrument,
)
from app.services.cgt_estimator import estimate_cgt
from app.services.event_detection import K_SIGMA, band_for, log_returns, score_series
from app.services.event_study import run as run_event_study
from app.services.health_config_service import resolve_health_config
from app.services.health_score import (
    DEFAULT_CONFIG,
    HealthConfig,
    compute_health_score,
)
from app.services.market_data_service import get_current_price
from app.services.ticker_map import canonical_key
from app.services.news_ranking import (
    MAX_DAYS_AFTER,
    MAX_DAYS_BEFORE,
    Bm25Index,
    counts_as_evidence,
    query_terms,
    score_articles,
)
from app.services.returns import (
    average_cost_realised_gain,
    pct_return,
    time_weighted_index,
    time_weighted_return_pct,
    xirr,
)
from app.services.risk_analytics import closes_for_tickers, single_ticker_closes
from app.services.snapshot_rebuild_service import position_on, rebuild_snapshots
from app.utils.stock_cache import get_cached_price_history, get_latest_close

logger = logging.getLogger(__name__)

MAX_EVENTS = 20
MAX_EXPLANATIONS = 5


def _news_window_utc(first: date, last: date) -> tuple[datetime, datetime]:
    start = datetime.combine(first - timedelta(days=MAX_DAYS_BEFORE + 1), datetime.min.time(),
                             tzinfo=timezone.utc)
    end = datetime.combine(last + timedelta(days=MAX_DAYS_AFTER + 1), datetime.max.time(),
                           tzinfo=timezone.utc)
    return start, end


TRACKING_R_SQUARED = 0.95
MARKET_MOVE_ABNORMAL_SHARE = 0.35
COMPANY_MOVE_ABNORMAL_SHARE = 0.65
EVENT_STUDY_PERIOD = "2y"
BENCHMARK_LOOKBACK_DAYS = 260
MAX_SERIES_TICKERS = 15


HEADLINE_TOLERANCE_PCT = 0.05
CHANCE_NOTE = (
    "if daily moves were normally distributed; real returns have fatter tails, so expect more"
)


def classify_move(market_pct: float | None, company_pct: float | None) -> str:
    if market_pct is None or company_pct is None:
        return "unknown"
    total = market_pct + company_pct
    if total == 0:
        return "unknown"

    if market_pct != 0 and (market_pct > 0) != (total > 0):
        return "against_market"
    if company_pct != 0 and (company_pct > 0) != (total > 0):
        return "market"

    share = company_pct / total
    if share >= COMPANY_MOVE_ABNORMAL_SHARE:
        return "company"
    if share <= MARKET_MOVE_ABNORMAL_SHARE:
        return "market"
    return "mixed"


def _to_float(value) -> float:
    return float(value) if value is not None else 0.0


USD_ZAR_TICKER = "USDZAR=X"


def _latest_usd_zar(db: Session | None = None) -> float | None:
    try:
        latest = get_latest_close(USD_ZAR_TICKER, db)
    except Exception as exc:
        logger.warning(f"USD/ZAR rate lookup failed: {exc}")
        return None

    if latest is None or latest.close is None:
        return None
    rate = float(latest.close)
    return rate if rate > 0 else None


def _price_holding(h, db: Session | None = None, usd_zar: float | None = None) -> dict:
    quantity = _to_float(h.quantity)
    total_cost = _to_float(h.total_cost)
    cost_price = _to_float(h.cost_price)

    daily_change_pct = None
    priced_live = False
    ticker = (h.ticker or "").strip()
    sector = h.sector

    known = resolve_known_instrument(h.instrument_name or "")
    if known:
        if not ticker or ticker.upper() in INVALID_TICKER_MARKERS:
            ticker = known.ticker
        if not sector or sector.lower() == "none":
            sector = known.sector

    if known:
        kind = known.kind
        region = known.region
    else:
        kind = KIND_ETF if looks_like_fund(h.instrument_name or "") else KIND_STOCK
        region = REGION_UNKNOWN

    currency = quote_currency(ticker, region)
    rate = usd_zar if currency not in (None, "ZAR") else None
    fx_rate = None
    can_price_live = (
        bool(ticker)
        and ticker.upper() not in INVALID_TICKER_MARKERS
        and currency is not None
        and (currency == "ZAR" or rate is not None)
    )

    current_price = cost_price
    if can_price_live:
        try:
            live = get_current_price(ticker, db)
            raw_price = live.price
            if raw_price is not None and not math.isnan(raw_price):
                current_price = raw_price * rate if rate else raw_price
                fx_rate = rate
                priced_live = True

                raw_change = live.change_percent
                daily_change_pct = (
                    raw_change
                    if raw_change is not None and not math.isnan(raw_change)
                    else None
                )
            else:
                logger.warning(f"live price fetch for {ticker} returned a NaN price, treating as unpriced")
        except Exception as exc:
            logger.warning(f"live price fetch failed for {ticker}: {exc}")

    statement_price = _to_float(getattr(h, "statement_price", None))
    statement_value = _to_float(getattr(h, "statement_value", None))
    if priced_live:
        price_source = "live"
        current_value = current_price * quantity
    elif statement_value or statement_price:
        price_source = "statement"
        current_price = statement_price or (statement_value / quantity if quantity else 0.0)
        current_value = statement_value or (statement_price * quantity)
    else:
        price_source = "cost"
        current_value = total_cost

    gain_loss = current_value - total_cost
    gain_loss_pct = (gain_loss / total_cost * 100) if total_cost else 0.0

    if sector and sector.lower() == "none":
        sector = None
    if sector:
        sector = normalize_sector(sector)
    if not ticker or ticker.upper() in INVALID_TICKER_MARKERS:
        ticker = h.instrument_name

    return {
        "ticker": ticker,
        "txn_key": h.ticker or h.instrument_name or "UNKNOWN",
        "name": known.display_name if known else h.instrument_name,
        "sector": sector,
        "kind": kind,
        "region": region,
        "priced_live": priced_live,
        "price_source": price_source,
        "quantity": quantity,
        "avg_cost": round(cost_price, 2),
        "total_cost": round(total_cost, 2),
        "current_price": round(current_price, 4),
        "value": round(current_value, 2),
        "gain_loss": round(gain_loss, 2),
        "gain_loss_pct": round(gain_loss_pct, 2),
        "daily_change_pct": round(daily_change_pct, 2) if daily_change_pct is not None else None,
        "quote_currency": currency,
        "fx_rate": fx_rate,
        "daily_change_is_local": currency not in (None, "ZAR"),
    }

def _price_holdings(holdings: list, db: Session | None = None) -> list[dict]:
    needs_fx = any(not is_zar_listed((h.ticker or "").strip()) for h in holdings)
    usd_zar = _latest_usd_zar(db) if needs_fx else None

    priced = [_price_holding(h, db, usd_zar) for h in holdings]

    if usd_zar is None and any(h["quote_currency"] not in (None, "ZAR") for h in priced):
        logger.warning(
            "no USD/ZAR close in the price cache - foreign holdings left unpriced rather than "
            "valued as though a dollar were a rand"
        )

    priced.sort(key=lambda h: h["value"], reverse=True)
    return priced

def _build_summary(priced_holdings: list[dict]) -> dict:
    total_value = sum(h["value"] for h in priced_holdings)
    total_cost = sum(h["total_cost"] for h in priced_holdings)
    total_gain_loss = total_value - total_cost
    total_gain_loss_pct = (total_gain_loss / total_cost * 100) if total_cost else 0.0
    moved = [h for h in priced_holdings if h["daily_change_pct"] is not None]
    priced_value = sum(h["value"] for h in moved)

    if moved and priced_value:
        daily_change_pct = sum(h["value"] * h["daily_change_pct"] for h in moved) / priced_value
        daily_change_value = sum(h["value"] * h["daily_change_pct"] / 100 for h in moved)
    else:
        daily_change_pct = None
        daily_change_value = None

    return {
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_pct": round(total_gain_loss_pct, 2),
        "num_holdings": len(priced_holdings),
        "daily_change_pct": round(daily_change_pct, 2) if daily_change_pct is not None else None,
        "daily_change_value": (
            round(daily_change_value, 2) if daily_change_value is not None else None
        ),
    }

def _build_sector_allocation(priced_holdings: list[dict]) -> list[dict]:
    totals: dict[str, float] = {}
    grand_total = sum(h["value"] for h in priced_holdings)
    for h in priced_holdings:
        sector = h["sector"] or "Other"
        if sector.lower() == "none":
            sector = "Other"
        totals[sector] = totals.get(sector, 0.0) + h["value"]

    return [
        {
            "sector": sector,
            "value": round(value, 2),
            "percentage": round((value / grand_total * 100) if grand_total else 0.0, 2),
        }
        for sector, value in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    ]

def _benchmark_weights(priced_holdings: list[dict]) -> dict[str, float]:
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return {}

    weights: dict[str, float] = {}
    unclassified = []
    for h in priced_holdings:
        if h["region"] not in REGION_BENCHMARKS:
            unclassified.append((h.get("ticker"), h.get("name"), h["region"]))
            continue
        weights[h["region"]] = weights.get(h["region"], 0.0) + h["value"] / total

    covered = sum(weights.values())
    if not covered:
        return {}

    return {region: weight / covered for region, weight in weights.items()}

def _history_period(since: date) -> str:
    days = (date.today() - since).days
    if days <= 30:
        return "3mo"
    if days <= 300:
        return "1y"
    if days <= 700:
        return "2y"
    return "5y"

def _closes_by_day(history) -> tuple[list[date], list[float]]:
    days = []
    closes = []
    for timestamp, close in history["Close"].sort_index().items():
        if close != close:
            continue
        days.append(timestamp.date())
        closes.append(float(close))
    return days, closes

def _close_on_or_before(days: list[date], closes: list[float], when: date) -> float | None:
    i = bisect_right(days, when) - 1
    return closes[i] if i >= 0 else None

def _index_levels(
    ticker: str, currency: str, since: date, target_currency: str = "ZAR"
) -> dict[date, float] | None:
    try:
        history = get_cached_price_history(ticker, period=_history_period(since), force_live=True)
    except Exception as exc:
        logger.warning(f"benchmark history fetch failed for {ticker}: {exc}")
        return None

    if history is None or history.empty:
        return None

    fx = None
    if currency != target_currency:
        if target_currency != "ZAR":
            logger.warning(f"cannot convert {ticker} from {currency} to {target_currency}")
            return None
        try:
            fx = get_cached_price_history("USDZAR=X", period=_history_period(since), force_live=True)
        except Exception as exc:
            logger.warning(f"USDZAR history fetch failed, cannot convert {ticker}: {exc}")
            return None
        if fx is None or fx.empty:
            return None
        fx_days, fx_closes = _closes_by_day(fx)

    levels: dict[date, float] = {}
    for timestamp, row in history.iterrows():
        day = timestamp.date()
        close = row["Close"]
        if close != close:
            continue

        level = float(close)
        if fx is not None:
            rate = _close_on_or_before(fx_days, fx_closes, day)
            if rate is None:
                continue
            level *= rate

        levels[day] = level

    return levels or None

def _history_is_incomplete(snapshot_history: list[dict], classified_txns: list[dict]) -> bool:
    if len(snapshot_history) < 2:
        return True

    dates = [txn["date"] for txn in classified_txns if txn.get("date")]
    if not dates:
        return False
    return snapshot_history[0]["snapshot_date"] > min(dates)


def _history_quality(
    rebuild, priced_holdings: list[dict], performance_history: list[dict]
) -> dict:
    if rebuild is not None:
        return {
            "first_day": rebuild.first_day.isoformat() if rebuild.first_day else None,
            "priced_value_pct": rebuild.priced_value_pct,
            "unpriced_tickers": rebuild.unpriced_tickers,
            "ledger_conflicts": rebuild.ledger_conflicts,
            "suspect_dates": rebuild.suspect_dates,
        }

    total = sum(h["value"] for h in priced_holdings)
    live = sum(h["value"] for h in priced_holdings if h["priced_live"])
    return {
        "first_day": performance_history[0]["date"] if performance_history else None,
        "priced_value_pct": round(live / total * 100, 1) if total else 0.0,
        "unpriced_tickers": sorted(
            h["ticker"] for h in priced_holdings if not h["priced_live"] and h["ticker"]
        ),
        "ledger_conflicts": None,
        "suspect_dates": None,
    }


def _portfolio_value_series(snapshot_history: list[dict]) -> dict[date, float]:
    if len(snapshot_history) < 2:
        return {}
    return {row["snapshot_date"]: row["total_value"] for row in snapshot_history}

def _relative_levels(history: list[dict]) -> list[tuple[date, float]]:
    rows = [
        r for r in history
        if r.get("twr_index") and r.get("benchmark") and r["twr_index"] > 0 and r["benchmark"] > 0
    ]
    if len(rows) < 2:
        return []

    levels = [(date.fromisoformat(rows[0]["date"]), 100.0)]
    for previous, row in pairwise(rows):
        relative = (
            math.log(row["twr_index"] / previous["twr_index"])
            - math.log(row["benchmark"] / previous["benchmark"])
        )
        levels.append((date.fromisoformat(row["date"]), levels[-1][1] * math.exp(relative)))
    return levels


def _divergences(history: list[dict], k_sigma: float) -> tuple[list[dict], dict]:
    levels = _relative_levels(history)
    scored = score_series(levels, k_sigma=k_sigma)
    coverage = {
        "available": scored["available"],
        "reason": scored["reason"],
        "observations": scored["observations"],
    }
    if not scored["available"]:
        return [], coverage

    by_date = {r["date"]: r for r in history}
    out = []
    for hit in scored["events"]:
        row = by_date.get(hit["date"])
        if row is None:
            continue
        previous = history[history.index(row) - 1]
        out.append({
            "date": hit["date"],
            "portfolio_return_pct": round(
                (row["twr_index"] / previous["twr_index"] - 1) * 100, 2
            ),
            "benchmark_return_pct": round(
                (row["benchmark"] / previous["benchmark"] - 1) * 100, 2
            ),
            "relative_return_pct": hit["return_pct"],
            "z_score": hit["z_score"],
            "annualised_volatility_pct": hit["annualised_volatility_pct"],
            "observations": scored["observations"],
            "direction": "ahead" if hit["log_return"] > 0 else "behind",
        })

    out.sort(key=lambda d: abs(d["z_score"]), reverse=True)
    return out[:MAX_EVENTS], coverage


def _build_contributions_series(
    snapshot_history: list[dict], contributions: list, invested_capital: float
) -> list[dict]:
    if len(snapshot_history) < 2:
        return []

    flows = [(c.transaction_date, _to_float(c.value_zar)) for c in contributions if c.transaction_date]

    recorded = sum(amount for _, amount in flows)
    opening_balance = max(invested_capital - recorded, 0.0)

    series = []
    flow_idx = 0
    running_total = opening_balance
    for row in snapshot_history:
        snap_date = row["snapshot_date"]
        while flow_idx < len(flows) and flows[flow_idx][0] <= snap_date:
            running_total += flows[flow_idx][1]
            flow_idx += 1
        value = row["total_value"]
        series.append({
            "date": snap_date.isoformat(),
            "name": snap_date.strftime("%b %d"),
            "portfolio_value": round(value, 2),
            "cumulative_net_contributions": round(running_total, 2),
            "cumulative_market_gain": round(value - running_total, 2),
        })
    return series

def _benchmark_series(
    priced_holdings: list[dict], since: date, base_value: float
) -> tuple[dict[date, float], list[dict]]:
    weights = _benchmark_weights(priced_holdings)
    if not weights:
        logger.info("benchmark debug: _benchmark_series aborting early, no regional weights")
        return {}, []

    components = []
    per_region_levels: dict[str, dict[date, float]] = {}
    for region, weight in weights.items():
        ticker, label, currency = REGION_BENCHMARKS[region]
        levels = _index_levels(ticker, currency, since)
        if not levels:
            logger.info("benchmark debug: dropping region=%s ticker=%s, no usable levels", region, ticker)
            continue
        per_region_levels[region] = levels
        components.append({"region": region, "label": label, "weight": round(weight * 100, 1)})

    if not per_region_levels:
        return {}, []

    covered = sum(weights[region] for region in per_region_levels)
    common_days = sorted(set.intersection(*(set(levels) for levels in per_region_levels.values())))
    if not common_days:
        return {}, []

    on_or_before = [day for day in common_days if day <= since]
    baseline_day = max(on_or_before) if on_or_before else common_days[0]

    series: dict[date, float] = {}
    for day in common_days:
        blended = 0.0
        for region, levels in per_region_levels.items():
            growth = levels[day] / levels[baseline_day]
            blended += (weights[region] / covered) * growth
        series[day] = round(base_value * blended, 2)

    return series, components

def benchmark_levels(
    region: str, since: date, target_currency: str = "ZAR"
) -> tuple[str, dict[date, float]] | None:
    entry = REGION_BENCHMARKS.get(region)
    if not entry:
        return None

    ticker, label, currency = entry
    levels = _index_levels(ticker, currency, since, target_currency)
    if not levels:
        return None
    return label, levels


def _nearest_benchmark(series: dict[date, float], days: list[date], when: date) -> float | None:
    i = bisect_right(days, when) - 1
    return series[days[i]] if i >= 0 else None


def _benchmark_label(components: list[dict]) -> str:
    if not components:
        return "No benchmark"
    if len(components) == 1:
        return components[0]["label"]
    parts = sorted(components, key=lambda c: c["weight"], reverse=True)
    return " + ".join(f"{c['label']} {c['weight']:.0f}%" for c in parts)

BUY_MARKERS = ("buy", "purchase")
SELL_MARKERS = ("sale", "sell")


def classify_instrument_txns(rows: list) -> list[dict]:
    classified = []
    for row in rows:
        if not row.transaction_date:
            logger.warning("instrument transaction with no date, skipped: %s", row.ticker)
            continue

        name = (row.transaction_name or "").lower()
        if any(marker in name for marker in SELL_MARKERS):
            side = "sell"
        elif any(marker in name for marker in BUY_MARKERS):
            side = "buy"
        else:
            logger.warning(
                "unrecognised transaction_name %r for %s, skipped from realised gain",
                row.transaction_name, row.ticker,
            )
            continue

        classified.append({
            "ticker": row.ticker or row.instrument_name or "UNKNOWN",
            "date": row.transaction_date,
            "side": side,
            "quantity": _to_float(row.quantity),
            "value_zar": _to_float(row.value_zar),
        })
    return classified


def _invested_flows(classified_txns: list[dict]) -> list[tuple[date, float]]:
    flows = []
    for txn in classified_txns:
        if not txn["date"]:
            continue
        amount = txn["value_zar"]
        flows.append((txn["date"], amount if txn["side"] == "buy" else -amount))
    return flows


def _first_purchase_dates(classified_txns: list[dict]) -> dict[str, date]:
    earliest: dict[str, date] = {}
    for t in classified_txns:
        if t["side"] != "buy":
            continue
        current = earliest.get(t["ticker"])
        if current is None or t["date"] < current:
            earliest[t["ticker"]] = t["date"]
    return earliest


def _money_weighted_flows(
    contributions, dividends, expenses, portfolio_value_today: float
) -> list[tuple[date, float]]:
    flows = [
        (c.transaction_date, -_to_float(c.value_zar)) for c in contributions if c.transaction_date
    ]
    flows += [
        (d.transaction_date, _to_float(d.net_dividend)) for d in dividends if d.transaction_date
    ]
    flows += [
        (e.transaction_date, -_to_float(e.value_zar)) for e in expenses if e.transaction_date
    ]
    flows.append((date.today(), portfolio_value_today))
    return flows


def _build_market_context(priced_holdings: list[dict]) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return {"available": False, "sectors": []}

    by_sector: dict[str, dict] = {}
    for h in priced_holdings:
        sector = h["sector"] or "Other"
        bucket = by_sector.setdefault(
            sector, {"value": 0.0, "priced_value": 0.0, "weighted_change": 0.0, "tickers": []}
        )
        bucket["value"] += h["value"]
        bucket["tickers"].append(h["ticker"])

        if h["daily_change_pct"] is not None:
            bucket["priced_value"] += h["value"]
            bucket["weighted_change"] += h["value"] * h["daily_change_pct"]

    sectors = []
    for sector, bucket in sorted(by_sector.items(), key=lambda kv: kv[1]["value"], reverse=True):
        names = ", ".join(bucket["tickers"])
        if bucket["priced_value"]:
            sector_change = bucket["weighted_change"] / bucket["priced_value"]
            direction = "up" if sector_change > 0 else "down" if sector_change < 0 else "flat"
            summary = (
                f"Your {sector} holdings ({names}) are {direction} "
                f"{abs(sector_change):.1f}% today."
            )
        else:
            sector_change = None
            summary = f"Your {sector} holdings ({names}) have no live price today."

        sectors.append({
            "sector": sector,
            "weight_pct": round(bucket["value"] / total * 100, 1),
            "priced_weight_pct": (
                round(bucket["priced_value"] / bucket["value"] * 100, 1) if bucket["value"] else 0.0
            ),
            "daily_change_pct": round(sector_change, 2) if sector_change is not None else None,
            "tickers": bucket["tickers"],
            "summary": summary,
        })

    return {"available": True, "label": "Illustrative market context", "sectors": sectors}


def _thresholds_payload(config: HealthConfig) -> dict:
    return {
        "concentration_low": config.concentration_low,
        "concentration_high": config.concentration_high,
    }


def _build_concentration_analysis(
    priced_holdings: list[dict], config: HealthConfig | None = None
) -> dict:
    config = config or DEFAULT_CONFIG
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return {
            "flagged": [],
            "health_score": compute_health_score(priced_holdings, config),
            "thresholds": _thresholds_payload(config),
        }

    flagged = []
    for h in priced_holdings:
        weight_pct = h["value"] / total * 100
        if weight_pct < config.concentration_high:
            continue

        target_pct = config.concentration_low
        reduce_value = (h["value"] - target_pct / 100 * total) / (1 - target_pct / 100)
        reduce_value = max(0.0, reduce_value)
        shares_to_sell = reduce_value / h["current_price"] if h["current_price"] else None

        flagged.append({
            "ticker": h["ticker"],
            "name": h["name"],
            "current_allocation_pct": round(weight_pct, 1),
            "target_allocation_pct": target_pct,
            "value_to_reduce": round(reduce_value, 2),
            "shares_to_sell": round(shares_to_sell, 2) if shares_to_sell is not None else None,
            "risk_band": "High",
            "look_through_note": get_look_through_note(h["ticker"]),
        })

    return {
        "flagged": flagged,
        "health_score": compute_health_score(priced_holdings, config),
        "thresholds": _thresholds_payload(config),
    }

SECTOR_INVESTMENT_PCT_OF_PORTFOLIO = 0.05


def _top_up_sector(priced_holdings: list[dict], sector: str, amount: float) -> list[dict] | None:
    held = sum(h["value"] for h in priced_holdings if h["sector"] == sector)
    if held <= 0:
        return None
    return [
        {**h, "value": h["value"] + amount * (h["value"] / held)} if h["sector"] == sector else h
        for h in priced_holdings
    ]


def _subscore_deltas(before_score: dict, after_score: dict) -> list[dict]:
    return [
        {"key": b["key"], "label": b["label"], "before": b["value"],
         "after": a["value"], "weight": b["weight"]}
        for b, a in zip(before_score["subscores"], after_score["subscores"], strict=True)
    ]


def _biggest_mover(deltas: list[dict]) -> str | None:
    if not deltas:
        return None
    return max(deltas, key=lambda d: abs(d["after"] - d["before"]) * d["weight"])["label"]


def _investment_explanation(
    sector: str, weight_pct: float, is_smallest: bool, deltas: list[dict], config: HealthConfig
) -> str:
    mover = _biggest_mover(deltas)
    moved = f" {mover} is the subscore that moved most." if mover else ""

    if weight_pct >= config.concentration_high:
        return (
            f"{sector} is already {weight_pct:.1f}% of your book, past the "
            f"{config.concentration_high:.0f}% your yardstick flags as concentrated. Adding more "
            f"here deepens that, which is why the score falls rather than rises.{moved}"
        )
    if weight_pct >= config.concentration_low:
        return (
            f"{sector} is {weight_pct:.1f}% of your book, already above the "
            f"{config.concentration_low:.0f}% watch level. Adding here leans further into a "
            f"sector you are already weighted toward.{moved}"
        )

    opening = (
        f"{sector} is currently your smallest sector weight at {weight_pct:.1f}% of your book. "
        if is_smallest else
        f"{sector} is {weight_pct:.1f}% of your book, below your most concentrated sector. "
    )
    return opening + (
        "Adding here spreads sector risk rather than adding to a sector you already lean on."
        + moved
    )


def _simulate_sector_investment(
    priced_holdings: list[dict], sector: str, config: HealthConfig | None = None
) -> dict:
    config = config or DEFAULT_CONFIG
    total = sum(h["value"] for h in priced_holdings)
    allocation = _build_sector_allocation(priced_holdings)
    current = next((s for s in allocation if s["sector"] == sector), None)
    if not total or current is None:
        return {"available": False, "reason": "unknown_sector"}

    amount = round(total * SECTOR_INVESTMENT_PCT_OF_PORTFOLIO, 2)
    hypothetical = _top_up_sector(priced_holdings, sector, amount)
    if hypothetical is None:
        return {"available": False, "reason": "unknown_sector"}

    before_score = compute_health_score(priced_holdings, config)
    after_score = compute_health_score(hypothetical, config)
    deltas = _subscore_deltas(before_score, after_score)
    projected_pct = round((current["value"] + amount) / (total + amount) * 100, 1)
    is_smallest = allocation[-1]["sector"] == sector

    return {
        "available": True,
        "sector": sector,
        "illustrative_amount": amount,
        "current_weight_pct": current["percentage"],
        "projected_weight_pct": projected_pct,
        "health_score_before": before_score["score"],
        "health_score_after": after_score["score"],
        "subscore_deltas": deltas,
        "is_smallest_sector": is_smallest,
        "explanation": _investment_explanation(
            sector, current["percentage"], is_smallest, deltas, config
        ),
        "thresholds": _thresholds_payload(config),
        "disclaimer": "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
    }


def _simulate_sector_rebalance(
    priced_holdings: list[dict], config: HealthConfig | None = None
) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    allocation = _build_sector_allocation(priced_holdings)
    if not total or len(allocation) < 2:
        return {"available": False, "reason": "insufficient_sectors"}

    config = config or DEFAULT_CONFIG
    highest, lowest = allocation[0], allocation[-1]
    if highest["percentage"] < config.concentration_high:
        return {
            "available": False,
            "reason": "no_sector_overconcentrated",
            "thresholds": _thresholds_payload(config),
        }

    target_pct = config.concentration_low
    reduce_value = (highest["value"] - target_pct / 100 * total) / (1 - target_pct / 100)
    reduce_value = max(0.0, min(reduce_value, highest["value"]))

    hypothetical = []
    for h in priced_holdings:
        if h["sector"] == highest["sector"] and highest["value"]:
            share = h["value"] / highest["value"]
            hypothetical.append({**h, "value": h["value"] - reduce_value * share})
        else:
            hypothetical.append(h)
    if reduce_value > 0:
        topped_up = _top_up_sector(hypothetical, lowest["sector"], reduce_value)
        if topped_up is None:
            return {"available": False, "reason": "unknown_sector"}
        hypothetical = topped_up

    before_score = compute_health_score(priced_holdings, config)
    after_score = compute_health_score(hypothetical, config)

    return {
        "available": True,
        "from_sector": highest["sector"],
        "to_sector": lowest["sector"],
        "value_shifted": round(reduce_value, 2),
        "from_sector_before_pct": highest["percentage"],
        "to_sector_before_pct": lowest["percentage"],
        "health_score_before": before_score["score"],
        "health_score_after": after_score["score"],
        "subscore_deltas": _subscore_deltas(before_score, after_score),
        "explanation": (
            f"{highest['sector']} is your most concentrated sector at {highest['percentage']:.1f}%; "
            f"{lowest['sector']} is your least at {lowest['percentage']:.1f}%. Shifting the excess above "
            "a healthy single-sector band into your thinnest sector lowers Herfindahl concentration on "
            "both ends of the spread at once."
        ),
        "thresholds": _thresholds_payload(config),
        "disclaimer": "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
    }


def _warn_on_mismatched_listings(account_type: str | None, priced_holdings: list[dict]) -> None:
    if account_type != "usd":
        return
    jse = sorted({h["ticker"] for h in priced_holdings if is_zar_listed(h.get("ticker"))})
    if jse:
        logger.warning(
            "USD account holds JSE-listed tickers (%s) - their prices are in rand cents, "
            "not dollars, so the account's totals mix currencies",
            ", ".join(jse),
        )


def _build_tax_analysis(account_type: str | None, priced_holdings: list[dict], instrument_txns: list) -> dict:
    cgt = estimate_cgt(account_type, priced_holdings, instrument_txns)
    if not cgt["available"]:
        return {**cgt, "holdings": []}

    holdings_breakdown = [
        {
            "ticker": h["ticker"],
            "name": h["name"],
            "unrealised_gain_loss": h["gain_loss"],
            "unrealised_gain_loss_pct": h["gain_loss_pct"],
        }
        for h in priced_holdings
    ]
    potential_realised_loss = sum(h["gain_loss"] for h in priced_holdings if h["gain_loss"] < 0)
    breakdown_total = sum(h["unrealised_gain_loss"] for h in holdings_breakdown)
    net_unrealised_gain = cgt.get("net_unrealised_gain")
    if net_unrealised_gain is not None and abs(breakdown_total - net_unrealised_gain) > 0.01:
        logger.warning(
            "Tax analysis cost-basis mismatch: sum(holdings_breakdown.unrealised_gain_loss)=%.2f "
            "!= cgt.net_unrealised_gain=%.2f (diff=%.2f). These are computed via independent "
            "cost-basis paths (average_cost_positions vs priced_holdings.gain_loss) that are "
            "not guaranteed to agree.",
            breakdown_total,
            net_unrealised_gain,
            breakdown_total - net_unrealised_gain,
        )

    return {
        **cgt,
        "holdings": holdings_breakdown,
        "potential_realised_loss": round(potential_realised_loss, 2),
        "note": (
            "Realising a loss can offset a capital gain elsewhere in the same tax year, subject to the "
            "annual exclusion above. This isn't tax advice - consult a tax practitioner before acting on it."
        ),
    }

TFSA_ANNUAL_LIMIT_ZAR = 46_000.0
TFSA_LIFETIME_LIMIT_ZAR = 500_000.0


def _build_tfsa_room(account_type: str | None, contributions: list) -> dict:
    if account_type != "tfsa":
        return {"available": False, "reason": "not_a_tfsa"}

    today = date.today()
    tax_year_start = date(today.year if today.month >= 3 else today.year - 1, 3, 1)

    lifetime_contributed = sum(
        _to_float(c.value_zar) for c in contributions if _to_float(c.value_zar) > 0
    )
    this_year_contributed = sum(
        _to_float(c.value_zar)
        for c in contributions
        if _to_float(c.value_zar) > 0 and c.transaction_date and c.transaction_date >= tax_year_start
    )

    return {
        "available": True,
        "tax_year_label": "2026/2027",
        "annual_limit": TFSA_ANNUAL_LIMIT_ZAR,
        "annual_contributed": round(this_year_contributed, 2),
        "annual_remaining": round(max(0.0, TFSA_ANNUAL_LIMIT_ZAR - this_year_contributed), 2),
        "lifetime_limit": TFSA_LIFETIME_LIMIT_ZAR,
        "lifetime_contributed": round(lifetime_contributed, 2),
        "lifetime_remaining": round(max(0.0, TFSA_LIFETIME_LIMIT_ZAR - lifetime_contributed), 2),
        "note": (
            "Unused annual room does not carry over to the next tax year. Withdrawing from a "
            "TFSA does not free up contribution room already used - SARS tracks total "
            "contributions made, not the current balance."
        ),
    }

PRICED_HOLDINGS_CACHE_TTL_SECONDS = 90

_priced_holdings_cache: dict[str, tuple[float, list[dict], list[UUID]]] = {}
_priced_holdings_locks: dict[str, threading.Lock] = {}
_priced_holdings_guard = threading.Lock()

_snapshot_maintenance_done: set[tuple[UUID, date]] = set()
EVENTS_CACHE_TTL_SECONDS = 900
_events_cache: dict[str, tuple[float, dict]] = {}


def _remember_snapshot_maintenance(marker: tuple[UUID, date]) -> None:
    with _priced_holdings_guard:
        for stale in [m for m in _snapshot_maintenance_done if m[1] != marker[1]]:
            _snapshot_maintenance_done.discard(stale)
        _snapshot_maintenance_done.add(marker)


def _copy_priced(priced: list[dict]) -> list[dict]:
    return [dict(h) for h in priced]


def _evict_expired(now: float) -> None:
    stale = [
        key for key, (cached_at, _, _) in _priced_holdings_cache.items()
        if now - cached_at >= PRICED_HOLDINGS_CACHE_TTL_SECONDS
    ]
    for key in stale:
        _priced_holdings_cache.pop(key, None)
        _priced_holdings_locks.pop(key, None)


def _read_priced_cache(key: str) -> tuple[list[dict], list[UUID]] | None:
    with _priced_holdings_guard:
        now = time.monotonic()
        _evict_expired(now)
        entry = _priced_holdings_cache.get(key)
        if entry is None:
            return None
        cached_at, priced, portfolio_ids = entry
        if now - cached_at >= PRICED_HOLDINGS_CACHE_TTL_SECONDS:
            return None
        return _copy_priced(priced), list(portfolio_ids)


def _lock_for_user(key: str) -> threading.Lock:
    with _priced_holdings_guard:
        return _priced_holdings_locks.setdefault(key, threading.Lock())


def _read_events_cache(key: str) -> dict | None:
    with _priced_holdings_guard:
        now = time.monotonic()
        for stale in [k for k, (at, _) in _events_cache.items()
                      if now - at >= EVENTS_CACHE_TTL_SECONDS]:
            _events_cache.pop(stale, None)
        entry = _events_cache.get(key)
        return entry[1] if entry else None


def _write_events_cache(key: str, payload: dict) -> None:
    with _priced_holdings_guard:
        _events_cache[key] = (time.monotonic(), payload)


def invalidate_priced_holdings(user_id: UUID | str | None = None) -> None:
    with _priced_holdings_guard:
        if user_id is None:
            _priced_holdings_cache.clear()
            _priced_holdings_locks.clear()
            _events_cache.clear()
        else:
            _priced_holdings_cache.pop(str(user_id), None)
            prefix = f"{user_id}:"
            for key in [k for k in _events_cache if k.startswith(prefix)]:
                _events_cache.pop(key, None)
            _evict_expired(time.monotonic())


class PortfolioService:
    def __init__(self, db: Session):
        self.db = db
        self.portfolio_repo = PortfolioRepository(db)
        self.holdings_repo = HoldingsRepository(db)

    def _get_holdings(self, user_id: UUID) -> tuple[list, list[UUID]]:
        latest_id = self.portfolio_repo.get_latest_portfolio_id(user_id)
        portfolio_ids = [latest_id] if latest_id else []
        holdings = self.holdings_repo.get_by_portfolio_ids(portfolio_ids)
        return holdings, portfolio_ids

    def _get_priced_holdings(self, user_id: UUID) -> tuple[list[dict], list[UUID]]:
        key = str(user_id)
        cached = _read_priced_cache(key)
        if cached is not None:
            return cached
        with _lock_for_user(key):
            cached = _read_priced_cache(key)
            if cached is not None:
                return cached

            holdings, portfolio_ids = self._get_holdings(user_id)
            priced = _price_holdings(holdings, self.db)
            with _priced_holdings_guard:
                _priced_holdings_cache[key] = (time.monotonic(), priced, portfolio_ids)
            return _copy_priced(priced), list(portfolio_ids)

    def get_summary(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        return _build_summary(priced)

    def get_sector_allocation(self, user_id: UUID) -> list[dict]:
        priced, _ = self._get_priced_holdings(user_id)
        return _build_sector_allocation(priced)

    def get_health(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        return compute_health_score(priced, resolve_health_config(self.db, user_id).config)

    def get_account_type(self, user_id: UUID) -> dict:
        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        return {
            "portfolio_id": str(portfolio.id) if portfolio else None,
            "account_type": portfolio.account_type if portfolio else None,
        }

    def set_account_type(self, user_id: UUID, account_type: str | None) -> dict:
        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        if portfolio is None:
            return {"portfolio_id": None, "account_type": None}
        self.portfolio_repo.set_account_type(portfolio.id, account_type)
        self.db.commit()
        return {"portfolio_id": str(portfolio.id), "account_type": account_type}

    def get_cgt_estimate(self, user_id: UUID) -> dict:
        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        account_type = portfolio.account_type if portfolio else None
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        instrument_txns = self.portfolio_repo.get_instrument_transactions(portfolio_ids)
        return estimate_cgt(account_type, priced_holdings, classify_instrument_txns(instrument_txns))

    def get_tax_analysis(self, user_id: UUID) -> dict:
        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        account_type = portfolio.account_type if portfolio else None
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        instrument_txns = self.portfolio_repo.get_instrument_transactions(portfolio_ids)
        return _build_tax_analysis(account_type, priced_holdings, classify_instrument_txns(instrument_txns))

    def get_tfsa_room(self, user_id: UUID) -> dict:
        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        account_type = portfolio.account_type if portfolio else None
        _, portfolio_ids = self._get_priced_holdings(user_id)
        contributions = self.portfolio_repo.get_contributions_and_withdrawals(portfolio_ids)
        return _build_tfsa_room(account_type, contributions)

    def get_market_context(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        return _build_market_context(priced)

    def get_concentration_analysis(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        config = resolve_health_config(self.db, user_id).config
        return _build_concentration_analysis(priced, config)

    def simulate_sector_investment(self, user_id: UUID, sector: str) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        config = resolve_health_config(self.db, user_id).config
        return _simulate_sector_investment(priced, sector, config)

    def simulate_sector_rebalance(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        config = resolve_health_config(self.db, user_id).config
        return _simulate_sector_rebalance(priced, config)

    def get_returns(self, user_id: UUID) -> dict:
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        snapshot_history = self.portfolio_repo.get_snapshot_history(portfolio_ids)
        return self._compute_returns(priced_holdings, portfolio_ids, snapshot_history)

    def _compute_returns(
        self,
        priced_holdings: list[dict],
        portfolio_ids: list[UUID],
        snapshot_history: list[dict],
        classified_txns: list[dict] | None = None,
        contributions: list | None = None,
    ) -> dict:
        portfolio_value = sum(h["value"] for h in priced_holdings)
        invested_capital = sum(h["total_cost"] for h in priced_holdings)
        priced = [h for h in priced_holdings
                  if h.get("price_source", "cost") != "cost" and h["total_cost"] > 0]
        live_value = sum(h["value"] for h in priced)
        live_cost = sum(h["total_cost"] for h in priced)
        unrealised_gain = live_value - live_cost
        simple_return = pct_return(unrealised_gain, live_cost)
        holdings_count = len(priced_holdings)
        priced_live_count = sum(1 for h in priced_holdings if h["priced_live"])
        priced_count = sum(1 for h in priced_holdings
                           if h.get("price_source", "cost") != "cost")

        if contributions is None:
            contributions = self.portfolio_repo.get_contributions_and_withdrawals(portfolio_ids)
        if classified_txns is None:
            classified_txns = classify_instrument_txns(
                self.portfolio_repo.get_instrument_transactions(portfolio_ids)
            )
        dividends = self.portfolio_repo.get_dividends(portfolio_ids)
        expenses = self.portfolio_repo.get_transaction_expenses(portfolio_ids)

        net_contributions = sum(_to_float(c.value_zar) for c in contributions)
        total_costs = sum(_to_float(e.value_zar) for e in expenses)

        realised_gain = average_cost_realised_gain(classified_txns)

        mwr_flows = _money_weighted_flows(contributions, dividends, expenses, portfolio_value)
        money_weighted = xirr(mwr_flows)

        twr_snapshots = [(row["snapshot_date"], row["total_value"]) for row in snapshot_history]
        time_weighted = time_weighted_return_pct(twr_snapshots, _invested_flows(classified_txns))

        history_days = None
        if snapshot_history:
            earliest = min(row["snapshot_date"] for row in snapshot_history)
            history_days = (date.today() - earliest).days

        return {
            "portfolio_value": round(portfolio_value, 2),
            "invested_capital": round(invested_capital, 2),
            "net_contributions": round(net_contributions, 2),
            "unrealised_gain": round(unrealised_gain, 2),
            "realised_gain": round(realised_gain, 2),
            "total_costs": round(total_costs, 2),
            "simple_return_pct": (
                None if simple_return is None else round(simple_return, 2)
            ),
            "money_weighted_return_pct": (
                None if money_weighted is None else round(money_weighted, 2)
            ),
            "time_weighted_return_pct": (
                None if time_weighted is None else round(time_weighted, 2)
            ),
            "snapshot_count": len(snapshot_history),
            "history_days": history_days,
            "holdings_count": holdings_count,
            "priced_live_count": priced_live_count,
            "priced_count": priced_count,
        }

    def _performance_and_benchmark(
        self, priced_holdings: list[dict], snapshot_history: list[dict],
        classified_txns: list[dict] | None = None,
    ) -> tuple[list[dict], list[dict]]:
        portfolio_series = _portfolio_value_series(snapshot_history)
        if not portfolio_series:
            return [], []

        first_day = min(portfolio_series)
        base_value = portfolio_series[first_day]
        benchmark_series, components = _benchmark_series(priced_holdings, first_day, base_value)

        twr = dict(time_weighted_index(
            sorted(portfolio_series.items()), _invested_flows(classified_txns or [])
        ))
        benchmark_days = sorted(benchmark_series)

        history = [
            {
                "date": day.isoformat(),
                "name": day.strftime("%b %d"),
                "value": portfolio_series[day],
                "benchmark": _nearest_benchmark(benchmark_series, benchmark_days, day),
                "twr_index": twr.get(day),
            }
            for day in sorted(portfolio_series)
        ]

        return history, components

    def get_performance_history(self, user_id: UUID) -> list[dict]:
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        snapshot_history = self.portfolio_repo.get_snapshot_history(portfolio_ids)
        history, _ = self._performance_and_benchmark(priced_holdings, snapshot_history)
        return history

    def get_dashboard(self, user_id: UUID) -> dict:
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        summary = _build_summary(priced_holdings)
        sector_allocation = _build_sector_allocation(priced_holdings)

        instrument_txns = self.portfolio_repo.get_instrument_transactions(portfolio_ids)
        classified_txns = classify_instrument_txns(instrument_txns)

        rebuild = None
        if portfolio_ids:
            today = date.today()
            marker = (portfolio_ids[0], today)
            if marker not in _snapshot_maintenance_done:
                try:
                    existing = self.portfolio_repo.get_snapshot_history(portfolio_ids)
                    if _history_is_incomplete(existing, classified_txns):
                        rebuild = rebuild_snapshots(self.db, portfolio_ids[0], classified_txns)
                    self.portfolio_repo.upsert_snapshot(
                        portfolio_ids[0], today, summary["total_value"], None
                    )
                    self.db.commit()
                except Exception as exc:
                    self.db.rollback()
                    logger.warning(f"snapshot maintenance failed for {portfolio_ids[0]}: {exc}")
                else:
                    _remember_snapshot_maintenance(marker)

        snapshot_history = self.portfolio_repo.get_snapshot_history(portfolio_ids)
        performance_history, components = self._performance_and_benchmark(
            priced_holdings, snapshot_history, classified_txns
        )
        contributions = self.portfolio_repo.get_contributions_and_withdrawals(portfolio_ids)
        returns_data = self._compute_returns(
            priced_holdings, portfolio_ids, snapshot_history, classified_txns, contributions
        )

        contributions_series = _build_contributions_series(
            snapshot_history, contributions, returns_data["invested_capital"]
        )

        portfolio = self.portfolio_repo.get_latest_portfolio(user_id)
        account_type = portfolio.account_type if portfolio else None
        _warn_on_mismatched_listings(account_type, priced_holdings)
        cgt = estimate_cgt(account_type, priced_holdings, classified_txns)
        first_purchase_dates = _first_purchase_dates(classified_txns)
        for h in priced_holdings:
            h["first_purchase_date"] = (
                first_purchase_dates.get(h["txn_key"]).isoformat()
                if h["txn_key"] in first_purchase_dates
                else None
            )

        health_config = resolve_health_config(self.db, user_id).config

        return {
            "summary": summary,
            "holdings": priced_holdings,
            "sectorAllocation": sector_allocation,
            "performanceHistory": performance_history,
            "historyQuality": _history_quality(rebuild, priced_holdings, performance_history),
            "benchmarkLabel": _benchmark_label(components),
            "benchmarkComposition": components,
            "returns": returns_data,
            "health": compute_health_score(priced_holdings, health_config),
            "thresholds": {
                "concentration_low": health_config.concentration_low,
                "concentration_high": health_config.concentration_high,
            },
            "contributionsSeries": contributions_series,
            "accountType": account_type,
            "statementDate": (
                portfolio.statement_end_date.isoformat()
                if portfolio and portfolio.statement_end_date else None
            ),
            "importedAt": (
                portfolio.created_at.date().isoformat()
                if portfolio and portfolio.created_at else None
            ),
            "historyStartsAt": (
                min(row["snapshot_date"] for row in snapshot_history).isoformat()
                if snapshot_history else None
            ),
            "cgt": cgt,
        }

    def get_events(self, user_id: UUID, period: str = "1y", k_sigma: float = K_SIGMA) -> dict:
        key = f"{user_id}:{period}:{k_sigma}"
        cached = _read_events_cache(key)
        if cached is not None:
            return cached

        priced, portfolio_ids = self._get_priced_holdings(user_id)
        tickers = [h["ticker"] for h in priced if h.get("ticker")]
        series_by_ticker = closes_for_tickers(tickers, period=period) if tickers else {}
        snapshot_history = self.portfolio_repo.get_snapshot_history(portfolio_ids)
        history, _ = self._performance_and_benchmark(priced, snapshot_history)
        divergences, divergence_coverage = _divergences(history, k_sigma)

        events = []
        scanned = []
        skipped = []
        scored_days_total = 0
        for h in priced:
            ticker = h.get("ticker")
            if not ticker:
                continue

            scored = score_series(series_by_ticker.get(ticker.upper(), []), k_sigma=k_sigma)
            if not scored["available"]:
                skipped.append({
                    "ticker": ticker,
                    "reason": scored["reason"],
                    "observations": scored["observations"],
                })
                continue

            scanned.append({
                "ticker": ticker,
                "name": h.get("name"),
                "observations": scored["observations"],
                "annualised_volatility_pct": scored["annualised_volatility_pct"],
            })
            scored_days_total += scored["scored_days"]
            for event in scored["events"]:
                events.append({
                    "ticker": ticker,
                    "name": h.get("name"),
                    "date": event["date"],
                    "return_pct": event["return_pct"],
                    "z_score": event["z_score"],
                    "direction": event["direction"],
                    "annualised_volatility_pct": event["annualised_volatility_pct"],
                    "observations": scored["observations"],
                    "daily_sigma_pct": event["daily_sigma_pct"],
                    "rank_in_period": event["rank_in_period"],
                    "period_days": event["period_days"],
                    "band": band_for(event["z_score"]),
                    "times_normal": round(abs(event["z_score"]), 1),
                })

        events.sort(key=lambda e: abs(e["z_score"]), reverse=True)
        returned = events[:MAX_EVENTS]
        self._flag_news_presence(returned)

        news_repo = NewsRepository(self.db)
        last_good = news_repo.last_run(("nightly", "backfill"), ("ok", "partial"))
        last_run = news_repo.last_run(("nightly", "backfill"), ("ok", "partial", "failed"))
        collected_at = None
        if last_good is not None and last_good.finished_at is not None:
            finished = last_good.finished_at
            if finished.tzinfo is None:
                finished = finished.replace(tzinfo=timezone.utc)
            collected_at = finished.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        payload = {
            "period": period,
            "k_sigma": k_sigma,
            "events": returned,
            "divergences": divergences,
            "coverage": {
                "holdings_total": len(priced),
                "holdings_scanned": len(scanned),
                "holdings_skipped": skipped,
                "holdings": scanned,
                "events_found": len(events),
                "events_returned": min(len(events), MAX_EVENTS),
                "divergence_scan": divergence_coverage,
                "scored_days_total": scored_days_total,
                "expected_by_chance": round(
                    scored_days_total * math.erfc(k_sigma / math.sqrt(2)), 1
                ),
                "chance_note": CHANCE_NOTE,
                "news_last_collected_at": collected_at,
                "news_last_run_status": last_run.status if last_run else None,
            },
        }
        _write_events_cache(key, payload)
        return payload

    def get_event_detail(self, user_id: UUID, ticker: str, event_date: date) -> dict:
        priced, portfolio_ids = self._get_priced_holdings(user_id)
        holding = next(
            (h for h in priced if (h.get("ticker") or "").upper() == ticker.upper()), None
        )
        if holding is None:
            return {"available": False, "reason": "not_held", "ticker": ticker}

        if is_region_benchmark(ticker, holding["region"]):
            return {
                "available": False,
                "reason": "benchmark_is_self",
                "ticker": ticker,
                "name": holding.get("name"),
                "date": event_date.isoformat(),
                "benchmark_label": REGION_BENCHMARKS[holding["region"]][1],
                "move_type": "market",
                "possible_explanations": self._possible_explanations(
                    ticker, holding.get("name") or "", event_date
                ),
            }

        stock_series = single_ticker_closes(ticker, period=EVENT_STUDY_PERIOD)
        if not stock_series:
            return {"available": False, "reason": "no_price_history", "ticker": ticker}

        since = event_date - timedelta(days=BENCHMARK_LOOKBACK_DAYS)
        benchmark = benchmark_levels(holding["region"], since, quote_currency(ticker, holding["region"]) or "ZAR")
        if benchmark is None:
            return {
                "available": False,
                "reason": "no_benchmark_for_region",
                "ticker": ticker,
                "region": holding["region"],
            }

        label, levels = benchmark
        study = run_event_study(stock_series, sorted(levels.items()), event_date)
        detected = dict(log_returns(stock_series)).get(event_date)
        move_pct = round((math.exp(detected) - 1) * 100, 2) if detected is not None else None

        decomposition = study.get("decomposition")
        decomposition_reason = None
        if decomposition and (
            move_pct is None
            or abs(decomposition["stock_return_pct"] - move_pct) > HEADLINE_TOLERANCE_PCT
        ):
            decomposition = None
            decomposition_reason = "benchmark_missing_day"

        earlier = [day for day, _ in stock_series if day < event_date]
        previous_day = max(earlier) if earlier else event_date - timedelta(days=1)

        payload = {
            "ticker": ticker,
            "name": holding.get("name"),
            "date": event_date.isoformat(),
            "benchmark_label": label,
            **study,
            "decomposition": decomposition,
            "decomposition_reason": decomposition_reason,
            "portfolio_impact": self._portfolio_impact(
                holding, priced, portfolio_ids, previous_day, move_pct
            ),
            "tracks_benchmark": bool(study.get("r_squared") is not None
                                     and study["r_squared"] >= TRACKING_R_SQUARED),
            "move_type": classify_move(
                decomposition["market_component_pct"], decomposition["company_component_pct"]
            ) if decomposition else "unknown",
            "possible_explanations": self._possible_explanations(
                ticker, holding.get("name") or "", event_date
            ),
            "note": (
                "Articles are listed because they are about this holding and close to this "
                "date. Nothing here establishes that any of them moved the price."
            ),
        }
        return payload

    def _portfolio_impact(
        self,
        holding: dict,
        priced: list[dict],
        portfolio_ids: list[UUID],
        previous_day: date,
        move_pct: float | None,
    ) -> dict:
        ticker = (holding["txn_key"] or "").strip().upper()
        txns = self.portfolio_repo.get_instrument_transactions(portfolio_ids)
        held, value = position_on(
            self.db, portfolio_ids, ticker, classify_instrument_txns(txns), previous_day
        )
        if held <= 0:
            return {
                "held_on_date": False,
                "weight_pct": None,
                "contribution_pct": None,
                "basis": "not_held",
            }

        snapshots = [
            row for row in self.portfolio_repo.get_snapshot_history(portfolio_ids)
            if row["snapshot_date"] <= previous_day
        ]
        if value is not None and snapshots and snapshots[-1]["total_value"] > 0:
            weight = value / snapshots[-1]["total_value"] * 100
            basis = "holdings_on_date"
        else:
            total = sum(h["value"] for h in priced)
            weight = holding["value"] / total * 100 if total else None
            basis = "current_weight"

        contribution = None
        if weight is not None and move_pct is not None:
            contribution = round(weight * move_pct / 100, 2)
        return {
            "held_on_date": True,
            "weight_pct": round(weight, 2) if weight is not None else None,
            "contribution_pct": contribution,
            "basis": basis,
        }

    def _flag_news_presence(self, events: list[dict]) -> None:
        if not events:
            return

        event_dates = [date.fromisoformat(e["date"]) for e in events]
        start, end = _news_window_utc(min(event_dates), max(event_dates))

        repo = NewsRepository(self.db)
        linked = repo.linked_articles(
            sorted({canonical_key(e["ticker"]) for e in events}), start, end
        )
        for event in events:
            terms = query_terms(event["ticker"], event.get("name") or "")
            day = date.fromisoformat(event["date"])
            event["has_news"] = any(
                counts_as_evidence(article, event["ticker"], terms, day)
                for article in linked.get(canonical_key(event["ticker"]), [])
            )

    def _possible_explanations(self, ticker: str, name: str, event_date: date) -> list[dict]:
        repo = NewsRepository(self.db)
        candidates = repo.articles_in_window(ticker, *_news_window_utc(event_date, event_date))
        if not candidates:
            return []

        key = canonical_key(ticker)
        index = Bm25Index(repo.corpus_for_idf())
        ranked = score_articles(
            [
                {
                    "external_id": a.external_id,
                    "title": a.title,
                    "description": a.description,
                    "url": a.url,
                    "source_name": a.source_name,
                    "published_at": a.published_at,
                    "ingest_mode": a.ingest_mode,
                    "fetched_at": a.fetched_at,
                    "match_score": link.match_score,
                    "highlight": link.highlight,
                }
                for a in candidates
                for link in a.tickers
                if link.ticker == key
            ],
            ticker, name, event_date, index,
        )

        return [
            {
                "article_id": row["article"]["external_id"],
                "title": row["article"]["title"],
                "url": row["article"]["url"],
                "source_name": row["article"]["source_name"],
                "published_at": row["article"]["published_at"].isoformat(),
                "scores": {
                    "bm25": row["bm25"],
                    "bm25_normalised": row["bm25_normalised"],
                    "date_proximity": row["date_proximity"],
                    "entity_match": row["entity_match"],
                    "combined": row["combined"],
                },
                "relevance": row["relevance"],
                "evidence": {
                    "named_in_headline": row["named_in_headline"],
                    "provider_match_score": row["article"]["match_score"],
                    "days_from_event": row["days_from_event"],
                    "highlight": row["article"]["highlight"],
                    "ingest_mode": row["article"]["ingest_mode"],
                    "collected_at": (
                        row["article"]["fetched_at"].isoformat() + "Z"
                        if row["article"]["fetched_at"] else None
                    ),
                },
            }
            for row in ranked[:MAX_EXPLANATIONS]
        ]

    def get_holding_series(self, user_id: UUID, tickers: list[str], period: str = "1y") -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        held = {(h.get("ticker") or "").upper(): h for h in priced if h.get("ticker")}

        wanted = []
        for raw in tickers[:MAX_SERIES_TICKERS]:
            ticker = raw.strip().upper()
            if ticker and ticker in held and ticker not in wanted:
                wanted.append(ticker)

        missing = [t.strip().upper() for t in tickers if t.strip().upper() not in held]
        if not wanted:
            return {"period": period, "series": [], "not_held": sorted(set(missing))}

        closes = closes_for_tickers(wanted, period=period)
        series = [
            {
                "ticker": ticker,
                "name": held[ticker].get("name"),
                "points": [
                    {"date": day.isoformat(), "close": round(price, 4)}
                    for day, price in closes.get(ticker, [])
                ],
            }
            for ticker in wanted
        ]
        return {
            "period": period,
            "series": series,
            "not_held": sorted(set(missing)),
        }
