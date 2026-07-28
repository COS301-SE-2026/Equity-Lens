import pandas as pd
from app.utils.stock_cache import get_cached_price_history
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
#Not yet connected to front end, connect to portfolio page
def get_current_price(symbol: str) -> CurrentPriceResponse:
    history = get_cached_price_history(symbol, period="1y")

    if history.empty:
        raise ValueError(f"No data found for symbol: {symbol}")

    latest = history.iloc[-1]
    price = float(latest["Close"])
    volume = int(latest["Volume"]) if not pd.isna(latest["Volume"]) else 0
    previous_close = latest.get("Prev Close")

    if previous_close is None or pd.isna(previous_close):
        if len(history) >= 2:
            previous_close = float(history.iloc[-2]["Close"])
        else:
            previous_close = price

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

    data = [
        HistoryDataPoint(
            date=index.to_pydatetime(),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            prev_close=float(row["Prev Close"]) if "Prev Close" in row and not pd.isna(row["Prev Close"]) else None,
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
        )
        for quote in getattr(search_results, "quotes", []) or []
        if quote.get("symbol")
    ]
    response = SearchResponse(query=query, results=results)
    _SEARCH_CACHE[normalized_query] = (time.time(), response)
    return response
