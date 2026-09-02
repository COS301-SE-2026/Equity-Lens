import math
import logging
import threading
import time
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.holdings_repository import HoldingsRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.instruments import (
    INVALID_TICKER_MARKERS,
    KIND_ETF,
    KIND_STOCK,
    REGION_BENCHMARKS,
    REGION_SA,
    REGION_UNKNOWN,
    get_look_through_note,
    is_zar_listed,
    looks_like_fund,
    normalize_sector,
    resolve_known_instrument,
)
from app.services.cgt_estimator import estimate_cgt
from app.services.health_config_service import resolve_health_config
from app.services.health_score import (
    CONCENTRATION_HIGH,
    CONCENTRATION_LOW,
    HealthConfig,
    compute_health_score,
)
from app.services.market_data_service import get_current_price
from app.services.returns import (
    average_cost_realised_gain,
    pct_return,
    time_weighted_index,
    time_weighted_return_pct,
    xirr,
)
from app.services.snapshot_rebuild_service import rebuild_snapshots
from app.utils.stock_cache import get_cached_price_history

logger = logging.getLogger(__name__)


def _to_float(value) -> float:
    return float(value) if value is not None else 0.0


def _price_holding(h) -> dict:
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

    current_price = cost_price
    if ticker and ticker.upper() not in INVALID_TICKER_MARKERS and is_zar_listed(ticker):
        try:
            live = get_current_price(ticker)
            raw_price = live.price
            if raw_price is not None and not math.isnan(raw_price):
                current_price = raw_price
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
    }

def _price_holdings(holdings: list) -> list[dict]:
    priced = [_price_holding(h) for h in holdings]
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

def _close_on_or_after(history, when: date) -> float | None:
    if history is None or history.empty:
        return None

    for timestamp, row in history.iterrows():
        if timestamp.date() < when:
            continue
        close = row["Close"]
        if close != close:
            continue
        return float(close)

    return None

def _index_levels(ticker: str, quote_currency: str, since: date) -> dict[date, float] | None:
    try:
        history = get_cached_price_history(ticker, period=_history_period(since), force_live=True)
    except Exception as exc:
        logger.warning(f"benchmark history fetch failed for {ticker}: {exc}")
        return None

    if history is None or history.empty:
        return None

    fx = None
    if quote_currency != "ZAR":
        try:
            fx = get_cached_price_history("USDZAR=X", period=_history_period(since), force_live=True)
        except Exception as exc:
            logger.warning(f"USDZAR history fetch failed, cannot convert {ticker}: {exc}")
            return None
        if fx is None or fx.empty:
            return None

    levels: dict[date, float] = {}
    for timestamp, row in history.iterrows():
        day = timestamp.date()
        close = row["Close"]
        if close != close:
            continue

        level = float(close)
        if fx is not None:

            rate = _close_on_or_after(fx, day)
            if rate is None:
                continue
            level *= rate

        levels[day] = level

    return levels or None

def _portfolio_value_series(snapshot_history: list[dict]) -> dict[date, float]:
    if len(snapshot_history) < 2:
        return {}
    return {row["snapshot_date"]: row["total_value"] for row in snapshot_history}

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
        ticker, label, quote_currency = REGION_BENCHMARKS[region]
        levels = _index_levels(ticker, quote_currency, since)
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

def _nearest_benchmark(series: dict[date, float], when: date) -> float | None:
    if not series:
        return None
    if when in series:
        return series[when]

    earlier = [day for day in series if day <= when]
    if not earlier:
        return None
    return series[max(earlier)]


def _benchmark_label(components: list[dict]) -> str:
    if not components:
        return "No benchmark"
    if len(components) == 1:
        return components[0]["label"]
    return "Blended benchmark"

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
        sector_change = (
            bucket["weighted_change"] / bucket["priced_value"] if bucket["priced_value"] else 0.0
        )
        direction = "up" if sector_change > 0 else "down" if sector_change < 0 else "flat"
        sectors.append({
            "sector": sector,
            "weight_pct": round(bucket["value"] / total * 100, 1),
            "daily_change_pct": round(sector_change, 2),
            "tickers": bucket["tickers"],
            "summary": (
                f"Your {sector} holdings ({', '.join(bucket['tickers'])}) are {direction} "
                f"{abs(sector_change):.1f}% today."
            ),
        })

    return {"available": True, "label": "Illustrative market context", "sectors": sectors}


def _build_concentration_analysis(priced_holdings: list[dict]) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return {"flagged": [], "health_score": compute_health_score(priced_holdings)}

    flagged = []
    for h in priced_holdings:
        weight_pct = h["value"] / total * 100
        if weight_pct < CONCENTRATION_HIGH:
            continue

        target_pct = CONCENTRATION_LOW
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

    return {"flagged": flagged, "health_score": compute_health_score(priced_holdings)}

SECTOR_INVESTMENT_PCT_OF_PORTFOLIO = 0.05


def _simulate_sector_investment(
    priced_holdings: list[dict], sector: str, config: HealthConfig | None = None
) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    allocation = _build_sector_allocation(priced_holdings)
    current = next((s for s in allocation if s["sector"] == sector), None)
    if not total or current is None:
        return {"available": False, "reason": "unknown_sector"}

    amount = round(total * SECTOR_INVESTMENT_PCT_OF_PORTFOLIO, 2)
    hypothetical = priced_holdings + [{
        "ticker": None, "value": amount, "sector": sector,
        "region": REGION_UNKNOWN, "kind": KIND_STOCK, "priced_live": True,
    }]
    before_score = compute_health_score(priced_holdings, config)
    after_score = compute_health_score(hypothetical, config)
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
        "is_smallest_sector": is_smallest,
        "explanation": (
            f"{sector} is currently your smallest sector weight at {current['percentage']:.1f}% of your book. "
            if is_smallest else
            f"{sector} is {current['percentage']:.1f}% of your book, below your most concentrated sector. "
        ) + "Adding here spreads sector risk rather than adding to a sector you already lean on, which is why Sector Concentration is the subscore most likely to move.",
        "disclaimer": "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
    }


def _simulate_sector_rebalance(
    priced_holdings: list[dict], config: HealthConfig | None = None
) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    allocation = _build_sector_allocation(priced_holdings)
    if not total or len(allocation) < 2:
        return {"available": False, "reason": "insufficient_sectors"}

    highest, lowest = allocation[0], allocation[-1]
    if highest["percentage"] < CONCENTRATION_HIGH:
        return {"available": False, "reason": "no_sector_overconcentrated"}

    target_pct = CONCENTRATION_LOW
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
        hypothetical.append({
            "ticker": None, "value": reduce_value, "sector": lowest["sector"],
            "region": REGION_UNKNOWN, "kind": KIND_STOCK, "priced_live": True,
        })
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
        "explanation": (
            f"{highest['sector']} is your most concentrated sector at {highest['percentage']:.1f}%; "
            f"{lowest['sector']} is your least at {lowest['percentage']:.1f}%. Shifting the excess above "
            "a healthy single-sector band into your thinnest sector lowers Herfindahl concentration on "
            "both ends of the spread at once."
        ),
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


PRICED_HOLDINGS_CACHE_TTL_SECONDS = 5

_priced_holdings_cache: dict[str, tuple[float, list[dict], list[UUID]]] = {}
_priced_holdings_locks: dict[str, threading.Lock] = {}
_priced_holdings_guard = threading.Lock()


def _copy_priced(priced: list[dict]) -> list[dict]:
    return [dict(h) for h in priced]


def _read_priced_cache(key: str) -> tuple[list[dict], list[UUID]] | None:
    with _priced_holdings_guard:
        entry = _priced_holdings_cache.get(key)
        if entry is None:
            return None
        cached_at, priced, portfolio_ids = entry
        if time.monotonic() - cached_at >= PRICED_HOLDINGS_CACHE_TTL_SECONDS:
            return None
        return _copy_priced(priced), list(portfolio_ids)


def _lock_for_user(key: str) -> threading.Lock:
    with _priced_holdings_guard:
        return _priced_holdings_locks.setdefault(key, threading.Lock())


def invalidate_priced_holdings(user_id: UUID | str | None = None) -> None:
    with _priced_holdings_guard:
        if user_id is None:
            _priced_holdings_cache.clear()
        else:
            _priced_holdings_cache.pop(str(user_id), None)


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
            priced = _price_holdings(holdings)
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
        return _build_concentration_analysis(priced)

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

        contributions = self.portfolio_repo.get_contributions_and_withdrawals(portfolio_ids)
        dividends = self.portfolio_repo.get_dividends(portfolio_ids)
        expenses = self.portfolio_repo.get_transaction_expenses(portfolio_ids)
        instrument_txns = self.portfolio_repo.get_instrument_transactions(portfolio_ids)

        net_contributions = sum(_to_float(c.value_zar) for c in contributions)
        total_costs = sum(_to_float(e.value_zar) for e in expenses)

        realised_gain = average_cost_realised_gain(classify_instrument_txns(instrument_txns))

        mwr_flows = _money_weighted_flows(contributions, dividends, expenses, portfolio_value)
        money_weighted = xirr(mwr_flows)

        twr_snapshots = [(row["snapshot_date"], row["total_value"]) for row in snapshot_history]
        time_weighted = time_weighted_return_pct(
            twr_snapshots, _invested_flows(classify_instrument_txns(instrument_txns))
        )

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

        history = [
            {
                "date": day.isoformat(),
                "name": day.strftime("%b %d"),
                "value": portfolio_series[day],
                "benchmark": _nearest_benchmark(benchmark_series, day),
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

        if portfolio_ids:
            if len(self.portfolio_repo.get_snapshot_history(portfolio_ids)) < 2:
                rebuild_snapshots(self.db, portfolio_ids[0], classified_txns)
            self.portfolio_repo.upsert_snapshot(
                portfolio_ids[0], date.today(), summary["total_value"], None
            )
            self.db.commit()

        snapshot_history = self.portfolio_repo.get_snapshot_history(portfolio_ids)
        performance_history, components = self._performance_and_benchmark(
            priced_holdings, snapshot_history, classified_txns
        )
        returns_data = self._compute_returns(priced_holdings, portfolio_ids, snapshot_history)

        contributions = self.portfolio_repo.get_contributions_and_withdrawals(portfolio_ids)
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
            "benchmarkLabel": _benchmark_label(components),
            "returns": returns_data,
            "health": compute_health_score(priced_holdings, health_config),
            "contributionsSeries": contributions_series,
            "accountType": account_type,
            "statementDate": (
                portfolio.statement_end_date.isoformat()
                if portfolio and portfolio.statement_end_date else None
            ),
            "cgt": cgt,
        }
