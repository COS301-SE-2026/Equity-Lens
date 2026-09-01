from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.market_data_service import get_current_price, get_historical_data, search_stocks
from app.schemas.market_data import CurrentPriceResponse, HistoryResponse, SearchResponse, CurrentPriceParams, SearchParams, HistoryParams

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

@router.get("/details", response_model=CurrentPriceResponse)
def stock_details(
    params: CurrentPriceParams = Depends(),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get full stock details"""
    return get_current_price(params.symbol)

@router.get("/history", response_model=HistoryResponse)
def stock_history(
    params: HistoryParams = Depends(),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get historical OHLCV data"""
    try:
        return get_historical_data(params.symbol,params.period)
    except Exception:
        raise HTTPException(status_code=400, detail="The History not working")

@router.get("/search", response_model=SearchResponse)
def search_stocks_endpoint(
    params: SearchParams = Depends(),
    current_user: UserResponse = Depends(get_current_user)
):
    """Search for stocks by name or symbol"""
    return search_stocks(params.query)