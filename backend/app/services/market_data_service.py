from datetime import datetime, timezone
from uuid import uuid4

import yfinance as yf

from app.schemas.market_data import (
    CurrentPriceResponse,
    HistoryDataPoint,
    HistoryResponse,
    SearchResponse,
    SearchResultItem,
)


def get_current_price(symbol: str) -> CurrentPriceResponse:
    ticker = yf.Ticker(symbol)
    history = ticker.history(period="1d")

    if history.empty:
        raise ValueError(f"No data found for symbol: {symbol}")

    latest = history.iloc[-1]
    price = float(latest["Close"])
    volume = int(latest["Volume"] or 0)
    previous_close = float(latest["Open"])
    change_percent = None

    if previous_close:
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
    ticker = yf.Ticker(symbol)
    history = ticker.history(period=period)

    if history.empty:
        raise ValueError(f"No historical data found for symbol: {symbol}")

    data = [
        HistoryDataPoint(
            date=index.to_pydatetime(),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=int(row["Volume"] or 0),
        )
        for index, row in history.iterrows()
    ]

    return HistoryResponse(symbol=symbol.upper(), period=period, data=data)


def search_stocks(query: str) -> SearchResponse:
    search_results = yf.Search(query, max_results=10)
    results = [
        SearchResultItem(
            symbol=quote.get("symbol", "N/A"),
            name=quote.get("longname") or quote.get("shortname") or quote.get("name", "N/A"),
        )
        for quote in getattr(search_results, "quotes", []) or []
        if quote.get("symbol")
    ]

    return SearchResponse(query=query, results=results)