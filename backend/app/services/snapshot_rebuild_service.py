from __future__ import annotations

import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market_data import MarketData
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.instruments import INVALID_TICKER_MARKERS
from app.services.market_data_service import _cents_to_major

logger = logging.getLogger(__name__)


def prices_by_day(observed: dict[date, float], days: list[date]) -> tuple[dict[date, float], int]:
    if not observed:
        return {}, 0

    resolved: dict[date, float] = {}
    gaps: list[date] = []
    last: float | None = None

    for day in days:
        if day in observed:
            last = observed[day]
            resolved[day] = last
        elif last is not None:
            resolved[day] = last
            gaps.append(day)
        else:
            gaps.append(day)

    first_close = observed[min(observed)]
    for day in gaps:
        resolved.setdefault(day, first_close)

    return resolved, len(gaps)


def _business_days(start: date, end: date) -> list[date]:
    days: list[date] = []
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _closes_by_day(
    db: Session, tickers: set[str], since: date, days: list[date]
) -> dict[str, dict[date, float]]:
    rows = db.execute(
        select(MarketData.ticker, MarketData.date, MarketData.close)
        .where(MarketData.ticker.in_(tickers), MarketData.date >= since)
    ).all()

    observed: dict[str, dict[date, float]] = {}
    for row in rows:
        observed.setdefault(row.ticker, {})[row.date] = float(row.close)

    missing = sorted(ticker for ticker in tickers if ticker not in observed)
    if missing:
        logger.warning(
            "no MarketData for %s",
            ", ".join(missing),
        )

    prices: dict[str, dict[date, float]] = {}
    for ticker, closes in observed.items():
        per_day, _ = prices_by_day(closes, days)
        divisor = _cents_to_major(ticker)
        prices[ticker] = {day: close / divisor for day, close in per_day.items()}
    return prices


def _apply(quantities: dict[str, float], txn: dict) -> None:
    ticker = txn["ticker"]
    held = quantities.get(ticker, 0.0)

    if txn["side"] == "buy":
        quantities[ticker] = held + txn["quantity"]
        return

    sold = txn["quantity"]
    if sold > held:
        logger.warning(
            "sale exceeds held quantity for %s (selling %s, held %s)",
            ticker, sold, held,
        )
        sold = held
    quantities[ticker] = held - sold


def _usable(txn: dict, today: date) -> bool:
    if not txn["date"] or txn["date"] > today:
        return False
    ticker = (txn["ticker"] or "").strip().upper()
    return bool(ticker) and ticker not in INVALID_TICKER_MARKERS


def rebuild_snapshots(db: Session, portfolio_id: UUID, txns: list[dict]) -> int:

    today = date.today()
    dated = sorted(
        (
            {**txn, "ticker": txn["ticker"].strip().upper()}
            for txn in txns
            if _usable(txn, today)
        ),
        key=lambda txn: txn["date"],
    )
    if not dated:
        return 0

    first_day = dated[0]["date"]
    days = _business_days(first_day, today)
    if not days:
        return 0

    prices = _closes_by_day(db, {txn["ticker"] for txn in dated}, first_day, days)
    if not prices:
        return 0

    repo = PortfolioRepository(db)
    quantities: dict[str, float] = {}
    next_txn = 0
    for day in days:
        while next_txn < len(dated) and dated[next_txn]["date"] <= day:
            _apply(quantities, dated[next_txn])
            next_txn += 1

        total = 0.0
        for ticker, held in quantities.items():
            if held > 0 and ticker in prices:
                total += held * prices[ticker][day]

        repo.upsert_snapshot(portfolio_id, day, round(total, 2), None)
    db.flush()
    return len(days)