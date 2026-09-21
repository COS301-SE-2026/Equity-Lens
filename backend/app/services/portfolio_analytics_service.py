from uuid import UUID
from sqlalchemy.orm import Session
from app.models.portfolio import Holdings
from app.services.indicator_service import (build_live_indicator_row,serialize_indicator_row,)
from app.services.instruments import resolve_known_instrument
from app.services.portfolio_service import INVALID_TICKER_MARKERS
from app.utils.market_cache import get_market_returns
from app.utils.stock_cache import get_cached_price_histories

def get_portfolio_analytics(db: Session, portfolio_id: UUID,):
    holdings = (db.query(Holdings).filter(Holdings.portfolio_id == portfolio_id).all())

    if not holdings:
        return []

    tickers = []

    ticker_to_name = {}

    for holding in holdings:
        ticker = (holding.ticker or "").strip()

        if(not ticker or ticker.upper() in INVALID_TICKER_MARKERS):
            known = resolve_known_instrument(holding.instrument_name or "")

            ticker = (known.ticker if known else "")

        if(not ticker or ticker.upper() in INVALID_TICKER_MARKERS):
            continue

        if ticker not in tickers:
            tickers.append(ticker)

            ticker_to_name[ticker] = (holding.instrument_name or ticker)
    
    if not tickers:
        return []

    market_returns = (get_market_returns())
    
    price_histories = (get_cached_price_histories(tickers,period="1y"))

    results = []

    for index,ticker in enumerate(tickers):
        name = ticker_to_name.get(ticker,ticker)

        row = build_live_indicator_row(ticker,name,market_returns,price_history=price_histories.get(ticker),)

        serialized = (serialize_indicator_row(row))

        results.append(serialized)

    return results