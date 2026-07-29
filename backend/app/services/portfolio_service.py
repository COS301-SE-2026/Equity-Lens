import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.holdings_repository import HoldingsRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.instruments import (
    KIND_ETF,
    KIND_STOCK,
    REGION_BENCHMARKS,
    REGION_UNKNOWN,
    is_zar_listed,
    looks_like_fund,
    normalize_sector,
    resolve_known_instrument,
)
from app.services.market_data_service import get_current_price, _cents_to_major
from app.utils.stock_cache import get_cached_price_history

logger = logging.getLogger(__name__)

INVALID_TICKER_MARKERS = {"MTN_LIMIT_ISSUE", "NONE"}

def _to_float(value) -> float:
    return float(value) if value is not None else 0.0


def _price_holding(h) -> dict:
    quantity = _to_float(h.quantity)
    total_cost = _to_float(h.total_cost)
    cost_price = _to_float(h.cost_price)

    daily_change_pct = 0.0
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
            current_price = live.price
            daily_change_pct = live.change_percent or 0.0
            priced_live = True
        except Exception as exc:
            logger.warning(f"live price fetch failed for {ticker}: {exc}")

    if priced_live:
        current_value = current_price * quantity
    else:
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
        "name": known.display_name if known else h.instrument_name,
        "sector": sector,
        "kind": kind,
        "region": region,
        "priced_live": priced_live,
        "quantity": quantity,
        "avg_cost": round(cost_price, 2),
        "total_cost": round(total_cost, 2),
        "current_price": round(current_price, 4),
        "value": round(current_value, 2),
        "gain_loss": round(gain_loss, 2),
        "gain_loss_pct": round(gain_loss_pct, 2),
        "daily_change_pct": round(daily_change_pct, 2),
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
    daily_change = (
        sum(h["value"] * h["daily_change_pct"] for h in priced_holdings) / total_value
        if total_value
        else 0.0
    )

    return {
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_pct": round(total_gain_loss_pct, 2),
        "num_holdings": len(priced_holdings),
        "daily_change": round(daily_change, 2),
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
    for h in priced_holdings:
        if h["region"] not in REGION_BENCHMARKS:
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
        history = get_cached_price_history(ticker, period=_history_period(since))
    except Exception as exc:
        logger.warning(f"benchmark history fetch failed for {ticker}: {exc}")
        return None

    if history is None or history.empty:
        return None

    fx = None
    if quote_currency != "ZAR":
        try:
            fx = get_cached_price_history("USDZAR=X", period=_history_period(since))
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

def _holding_value_series(h: dict, since: date) -> dict[date, float] | None:
    ticker = h["ticker"]
    if not ticker or ticker.upper() in INVALID_TICKER_MARKERS:
        return None
    if not is_zar_listed(ticker):
        return None

    try:
        history = get_cached_price_history(ticker, period=_history_period(since))
    except Exception as exc:
        logger.warning(f"portfolio history fetch failed for {ticker}: {exc}")
        return None

    if history is None or history.empty:
        return None
    
    divisor = _cents_to_major(ticker)
    quantity = h["quantity"]
    levels: dict[date, float] = {}
    for timestamp, row in history.iterrows():
        close = row["Close"]
        if close != close:
            continue

        levels[timestamp.date()] = (float(close) / divisor) * quantity

    return levels or None


def _portfolio_value_series(priced_holdings: list[dict], since: date) -> dict[date, float]:
    per_holding_levels = []
    for h in priced_holdings:
        levels = _holding_value_series(h, since)
        if levels:
            per_holding_levels.append(levels)

    if not per_holding_levels:
        return {}

    common_days = sorted(set.intersection(*(set(levels) for levels in per_holding_levels)))
    if not common_days:
        return {}

    return {day: round(sum(levels[day] for levels in per_holding_levels), 2) for day in common_days}


def _benchmark_series(
    priced_holdings: list[dict], since: date, base_value: float
) -> tuple[dict[date, float], list[dict]]:
    weights = _benchmark_weights(priced_holdings)
    if not weights:
        return {}, []

    components = []
    per_region_levels: dict[str, dict[date, float]] = {}
    for region, weight in weights.items():
        ticker, label, quote_currency = REGION_BENCHMARKS[region]
        levels = _index_levels(ticker, quote_currency, since)
        if not levels:
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
        holdings, portfolio_ids = self._get_holdings(user_id)
        return _price_holdings(holdings), portfolio_ids

    def get_summary(self, user_id: UUID) -> dict:
        priced, _ = self._get_priced_holdings(user_id)
        return _build_summary(priced)

    def get_sector_allocation(self, user_id: UUID) -> list[dict]:
        priced, _ = self._get_priced_holdings(user_id)
        return _build_sector_allocation(priced)

    def _performance_and_benchmark(
        self, priced_holdings: list[dict]
    ) -> tuple[list[dict], list[dict]]:
        since = date.today() - timedelta(days=365)
        portfolio_series = _portfolio_value_series(priced_holdings, since)
        if not portfolio_series:
            return [], []

        first_day = min(portfolio_series)
        base_value = portfolio_series[first_day]
        benchmark_series, components = _benchmark_series(priced_holdings, first_day, base_value)

        history = [
            {
                "date": day.isoformat(),
                "name": day.strftime("%b %d"),
                "value": portfolio_series[day],
                "benchmark": _nearest_benchmark(benchmark_series, day),
            }
            for day in sorted(portfolio_series)
        ]

        return history, components

    def get_performance_history(self, user_id: UUID) -> list[dict]:
        priced_holdings, _ = self._get_priced_holdings(user_id)
        history, _ = self._performance_and_benchmark(priced_holdings)
        return history

    def get_dashboard(self, user_id: UUID) -> dict:
        priced_holdings, portfolio_ids = self._get_priced_holdings(user_id)
        summary = _build_summary(priced_holdings)
        sector_allocation = _build_sector_allocation(priced_holdings)

        if portfolio_ids:
            self.portfolio_repo.upsert_snapshot(
                portfolio_ids[0], date.today(), summary["total_value"], None
            )

        performance_history, components = self._performance_and_benchmark(priced_holdings)

        return {
            "summary": summary,
            "holdings": priced_holdings,
            "sectorAllocation": sector_allocation,
            "performanceHistory": performance_history,
            "benchmarkLabel": _benchmark_label(components),
        }
