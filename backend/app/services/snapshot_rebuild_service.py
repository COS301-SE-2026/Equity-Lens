from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date
from itertools import pairwise
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market_data import MarketData
from app.repositories.holdings_repository import HoldingsRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.instruments import INVALID_TICKER_MARKERS
from app.services.market_data_service import _cents_to_major

logger = logging.getLogger(__name__)

MIN_COVERAGE_PCT = 80.0

SPLIT_SUSPECT_PCT = 35.0


@dataclass(frozen=True)
class RebuildResult:
    days_written: int = 0
    first_day: date | None = None
    priced_value_pct: float = 0.0
    unpriced_tickers: list[str] = field(default_factory=list)
    ledger_conflicts: int = 0
    suspect_dates: list[str] = field(default_factory=list)


def prices_by_day(observed: dict[date, float], days: list[date]) -> tuple[dict[date, float], int]:
    if not observed:
        return {}, 0

    resolved: dict[date, float] = {}
    gaps = 0
    last: float | None = None

    for day in days:
        if day in observed:
            last = observed[day]
            resolved[day] = last
        elif last is not None:
            resolved[day] = last
            gaps += 1

    return resolved, gaps


def _observed_closes(db: Session, tickers: set[str], since: date) -> dict[str, dict[date, float]]:
    rows = db.execute(
        select(MarketData.ticker, MarketData.date, MarketData.close)
        .where(MarketData.ticker.in_(tickers), MarketData.date >= since)
    ).all()

    observed: dict[str, dict[date, float]] = {}
    for row in rows:
        close = float(row.close)
        if not math.isfinite(close):
            logger.warning("ignoring unusable close for %s on %s", row.ticker, row.date)
            continue
        observed.setdefault(row.ticker, {})[row.date] = close / _cents_to_major(row.ticker)

    return observed


def _trading_days(observed: dict[str, dict[date, float]], start: date, end: date) -> list[date]:
    days = {day for closes in observed.values() for day in closes if start <= day <= end}
    return sorted(days)


def _closing_book(db: Session, portfolio_id: UUID) -> dict[str, dict[str, float]]:
    book: dict[str, dict[str, float]] = {}
    for holding in HoldingsRepository(db).get_by_portfolio_ids([portfolio_id]):
        ticker = (holding.ticker or holding.instrument_name or "").strip().upper()
        if not ticker or ticker in INVALID_TICKER_MARKERS:
            continue
        entry = book.setdefault(ticker, {"quantity": 0.0, "cost_price": 0.0})
        entry["quantity"] += float(holding.quantity or 0)
        entry["cost_price"] = float(holding.cost_price or 0) or entry["cost_price"]
    return book


def _coverage(
    book: dict[str, dict[str, float]], observed: dict[str, dict[date, float]]
) -> tuple[float, list[str]]:
    priced_value = 0.0
    unpriced_value = 0.0
    unpriced: list[str] = []

    for ticker, entry in book.items():
        closes = observed.get(ticker)
        if closes:
            priced_value += entry["quantity"] * closes[max(closes)]
        else:
            unpriced_value += entry["quantity"] * entry["cost_price"]
            unpriced.append(ticker)

    total = priced_value + unpriced_value
    pct = round(priced_value / total * 100, 1) if total else 0.0
    return pct, sorted(unpriced)


def _suspect_moves(
    observed: dict[str, dict[date, float]], txns_by_ticker: dict[str, set[date]]
) -> list[str]:
    suspect: set[date] = set()
    for ticker, closes in observed.items():
        ordered = sorted(closes)
        for previous, current in pairwise(ordered):
            before = closes[previous]
            if before <= 0:
                continue
            move_pct = abs(closes[current] - before) / before * 100
            if move_pct >= SPLIT_SUSPECT_PCT and current not in txns_by_ticker.get(ticker, set()):
                suspect.add(current)
    return [day.isoformat() for day in sorted(suspect)]


def _undo(quantities: dict[str, float], txn: dict) -> bool:
    ticker = txn["ticker"]
    held = quantities.get(ticker, 0.0)

    if txn["side"] == "sell":
        quantities[ticker] = held + txn["quantity"]
        return False

    bought = txn["quantity"]
    conflicted = bought > held
    if conflicted:
        logger.warning(
            "buy exceeds the position held after it for %s (buying %s, held %s) - the "
            "transaction ledger and the closing holdings disagree",
            ticker, bought, held,
        )
        bought = held
    quantities[ticker] = held - bought
    return conflicted


def _usable(txn: dict, today: date) -> bool:
    if not txn["date"] or txn["date"] > today:
        return False
    ticker = (txn["ticker"] or "").strip().upper()
    return bool(ticker) and ticker not in INVALID_TICKER_MARKERS


def rebuild_snapshots(db: Session, portfolio_id: UUID, txns: list[dict]) -> RebuildResult:

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
        return RebuildResult()

    book = _closing_book(db, portfolio_id)
    tickers = {txn["ticker"] for txn in dated} | set(book)
    observed = _observed_closes(db, tickers, dated[0]["date"])

    priced_value_pct, unpriced = _coverage(book, observed)
    txns_by_ticker: dict[str, set[date]] = {}
    for txn in dated:
        txns_by_ticker.setdefault(txn["ticker"], set()).add(txn["date"])
    suspect_dates = _suspect_moves(
        {t: c for t, c in observed.items() if t in book}, txns_by_ticker
    )

    partial = RebuildResult(
        priced_value_pct=priced_value_pct,
        unpriced_tickers=unpriced,
        suspect_dates=suspect_dates,
    )
    if priced_value_pct < MIN_COVERAGE_PCT:
        logger.warning(
            "refusing to rebuild snapshots for %s: only %.1f%% of the book can be priced "
            "(no MarketData for %s)",
            portfolio_id, priced_value_pct, ", ".join(unpriced) or "-",
        )
        return partial

    held_closes = [observed[t] for t in book if observed.get(t)]
    if not held_closes:
        return partial
    start = max(min(closes) for closes in held_closes)

    days = _trading_days(observed, start, today)
    if not days:
        return partial

    prices = {ticker: prices_by_day(closes, days)[0] for ticker, closes in observed.items()}

    repo = PortfolioRepository(db)
    quantities = {ticker: entry["quantity"] for ticker, entry in book.items()}
    conflicts = 0
    next_txn = len(dated) - 1
    for day in reversed(days):
        while next_txn >= 0 and dated[next_txn]["date"] > day:
            if _undo(quantities, dated[next_txn]):
                conflicts += 1
            next_txn -= 1

        total = 0.0
        for ticker, held in quantities.items():
            close = prices.get(ticker, {}).get(day)
            if held > 0 and close is not None:
                total += held * close

        repo.upsert_snapshot(portfolio_id, day, round(total, 2), None)

    return RebuildResult(
        days_written=len(days),
        first_day=days[0],
        priced_value_pct=priced_value_pct,
        unpriced_tickers=unpriced,
        ledger_conflicts=conflicts,
        suspect_dates=suspect_dates,
    )


def position_on(
    db: Session, portfolio_ids: list[UUID], ticker: str, txns: list[dict], day: date
) -> tuple[float, float | None]:
    quantities = {
        ticker: sum(
            _closing_book(db, portfolio_id).get(ticker, {}).get("quantity", 0.0)
            for portfolio_id in portfolio_ids
        )
    }

    today = date.today()
    later = sorted(
        (
            {**txn, "ticker": txn["ticker"].strip().upper()}
            for txn in txns
            if _usable(txn, today) and txn["date"] > day
        ),
        key=lambda txn: txn["date"],
    )
    for txn in reversed(later):
        if txn["ticker"] == ticker:
            _undo(quantities, txn)

    held = quantities[ticker]
    close = _observed_closes(db, {ticker}, day).get(ticker, {}).get(day)
    if held <= 0 or close is None:
        return held, None
    return held, held * close
