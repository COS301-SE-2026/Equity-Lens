import time
import secrets
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.portfolio import Portfolios, Holdings
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.indicator_service import build_live_indicator_row, serialize_indicator_row
from app.services.instruments import resolve_known_instrument
from app.services.portfolio_service import INVALID_TICKER_MARKERS
from app.utils.market_cache import get_market_returns

router = APIRouter(prefix="/api/indicators", tags=["indicators"])

@router.get("")
def get_indicators(current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolios = db.query(Portfolios).filter(Portfolios.user_id == current_user.id).all()
    # NOTE: We are filtering out tickers that are empty strings or null.
    # However, we decided NOT to filter out tickers with less than 1 year of history
    # here because the build_live_indicator_row function handles that gracefully
    # and returns a "insufficient_data" status for those specific tickers.
    portfolio_ids = [p.id for p in portfolios]

    if not portfolio_ids:
        return []

    tickers = []
    ticker_to_name = {}
    market_returns = get_market_returns()
    holdings = db.query(Holdings).filter(Holdings.portfolio_id.in_(portfolio_ids)).all()

    for h in holdings: 
        ticker = (h.ticker or "").strip()
        if not ticker or ticker.upper() in INVALID_TICKER_MARKERS:
            known = resolve_known_instrument(h.instrument_name or "")
            ticker = known.ticker if known else ""
        if not ticker or ticker.upper() in INVALID_TICKER_MARKERS:
            continue
        if ticker not in tickers:
            tickers.append(ticker)
            ticker_to_name[ticker] = h.instrument_name or ticker

    if not tickers:
        return []
    
    results = []
    for index, ticker in enumerate(tickers):
        name = ticker_to_name.get(ticker, ticker)
        row = build_live_indicator_row(ticker,name,market_returns)
        results.append(serialize_indicator_row(row))
        #Small delay between tickers to try and avoid yfinance rate limiting
        if index < len(tickers) - 1:
            time.sleep(secrets.SystemRandom().uniform(1.0, 2.0))

    return results