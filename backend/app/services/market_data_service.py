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
    
    info = ticker.info
    previous_close = info.get('previousClose') or info.get('regularMarketPreviousClose')

    if previous_close is None:
        hist = ticker.history(period="2d")
        if len(hist) >= 2:
            previous_close = float(hist.iloc[-2]['Close'])
        else:
            previous_close = float(hist.iloc[-1]['Open'])
    
    history = ticker.history(period="1d")

    if history.empty:
        raise ValueError(f"No data found for symbol: {symbol}")

    latest = history.iloc[-1]
    price = float(latest["Close"])
    volume = int(latest["Volume"] or 0)
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
