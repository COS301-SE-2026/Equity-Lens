import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.market_data import MarketData
from app.utils.stock_cache import get_cached_price_history, get_latest_close, is_stale
from datetime import datetime, timezone
from uuid import uuid4
import time

import yfinance as yf

from app.schemas.market_data import (
    CurrentPriceResponse,
    HistoryDataPoint,
    HistoryResponse,
    SearchResponse,
    SearchResultItem,
)
def _cents_to_major(symbol: str) -> float:
    if symbol.startswith("^"):
        return 1.0
    return 100.0 if symbol.upper().endswith(".JO") else 1.0

WATCHLIST_QUOTE_TYPES = {"EQUITY", "ETF", "INDEX"}

def _second_last_close(symbol: str, db: Session | None) -> float | None:
    stmt = (
        select(MarketData.close)
        .where(MarketData.ticker == symbol.upper(), MarketData.close.isnot(None))
        .order_by(MarketData.date.desc())
        .limit(2)
    )
    if db is not None:
        rows = db.execute(stmt).all()
    else:
        own = SessionLocal()
        try:
            rows = own.execute(stmt).all()
        finally:
            own.close()

    return float(rows[1][0]) if len(rows) >= 2 else None


def get_current_price(symbol: str, db: Session | None = None) -> CurrentPriceResponse:
    latest = get_latest_close(symbol, db)
    if is_stale(latest):
        get_cached_price_history(symbol, period="1y")
        latest = get_latest_close(symbol, db)

    if latest is None:
        raise ValueError(f"No data found for symbol: {symbol}")

    divisor = _cents_to_major(symbol)
    price = float(latest.close) / divisor
    volume = int(latest.volume) if latest.volume is not None else 0
    previous_close = latest.prev_close

    if previous_close is None or pd.isna(previous_close):
        second_last = _second_last_close(symbol, db)
        previous_close = second_last / divisor if second_last is not None else price
    else:
        previous_close = float(previous_close) / divisor

    change_percent = None
    if previous_close and previous_close != 0:
        change_percent = ((price - previous_close) / previous_close) * 100

    return CurrentPriceResponse(
        id=uuid4(),
        ticker=symbol.upper(),
        price=round(price, 4),
        volume=volume,
        change_percent=round(change_percent, 4) if change_percent is not None else None,
        fetched_at=datetime.now(timezone.utc),
    )


def get_historical_data(symbol: str, period: str) -> HistoryResponse:
    history = get_cached_price_history(symbol, period=period)

    if history.empty:
        raise ValueError(f"No historical data found for symbol: {symbol}")

    divisor = _cents_to_major(symbol)
    data = [
        HistoryDataPoint(
            date=index.to_pydatetime(),
            open=float(row["Open"]) / divisor,
            high=float(row["High"]) / divisor,
            low=float(row["Low"]) / divisor,
            close=float(row["Close"]) / divisor,
            prev_close=float(row["Prev Close"]) / divisor if "Prev Close" in row and not pd.isna(row["Prev Close"]) else None,
            volume=int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
        )
        for index, row in history.iterrows()
    ]

    return HistoryResponse(symbol=symbol.upper(), period=period, data=data)

_SEARCH_CACHE: dict[str, tuple[float, SearchResponse]] = {}
_SEARCH_CACHE_TTL_SECONDS = 300
#In-memory cache to avoid yfinance rate-limiting (aggressive requests get rate limited fast
#- see stock_cache.py for reference), 5 minutes TTL and no persistency.
def search_stocks(query: str) -> SearchResponse:
    normalized_query= query.strip().lower()
    cached = _SEARCH_CACHE.get(normalized_query)
    if cached is not None:
        cached_at, cached_response = cached
        if time.time() - cached_at < _SEARCH_CACHE_TTL_SECONDS:
            return cached_response
        
    search_results = yf.Search(query, max_results=10)
    results = [
        SearchResultItem(
            symbol=quote.get("symbol", "N/A"),
            name=quote.get("longname") or quote.get("shortname") or quote.get("name", "N/A"),
            quote_type=quote.get("quoteType"),
        )
        for quote in getattr(search_results, "quotes", []) or []
        if quote.get("symbol") and quote.get("quoteType") in WATCHLIST_QUOTE_TYPES
    ]
    response = SearchResponse(query=query, results=results)
    _SEARCH_CACHE[normalized_query] = (time.time(), response)
    return response
