from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.market_data_service import get_current_price, get_historical_data, search_stocks
from app.schemas.market_data import CurrentPriceResponse, HistoryResponse, SearchResponse

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

@router.get("/preview")
def preview_stock(
    symbol: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get current stock price preview"""
    return get_current_price(symbol)

@router.get("/details")
def stock_details(
    symbol: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get full stock details"""
    return get_current_price(symbol)

@router.get("/history")
def stock_history(
    symbol: str,
    period: str = "1mo",
    current_user: UserResponse = Depends(get_current_user)
):
    """Get historical OHLCV data"""
    return get_historical_data(symbol,period)

@router.get("/search")
def search_stocks_endpoint(
    query: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Search for stocks by name or symbol"""
    return search_stocks(query)