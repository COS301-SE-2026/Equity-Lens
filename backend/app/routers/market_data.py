from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.market_data_service import get_current_price, get_historical_data, search_stocks
from app.schemas.market_data import CurrentPriceResponse, HistoryResponse, SearchResponse, CurrentPriceParams, SearchParams, HistoryParams

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

@router.get("/details", response_model=CurrentPriceResponse, summary="Get Stock Details", description="Fetch current price, volume, and percentage change for a given stock symbol.",)
def stock_details(
    params: CurrentPriceParams = Depends(),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get full stock details"""
    return get_current_price(params.symbol)

@router.get("/history", response_model=HistoryResponse,
            summary="Get Stock Historical Data",
            description="Fetch historical OHLCV data for a specific symbol over a defined time range.",
            responses={
                400: {
                    "description": "Failed to retrieve historical data for the requested symbol/period"
                }
            },)
def stock_history(
    params: HistoryParams = Depends(),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get historical OHLCV data"""
    try:
        return get_historical_data(params.symbol,params.period)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unable to fetch history for symbol '{params.symbol}': {str(e)}",)

@router.get("/search", response_model=SearchResponse,
            summary="Search Stocks",
            description="Search for available stocks by symbol or company name.",)
def search_stocks_endpoint(
    params: SearchParams = Depends(),
    current_user: UserResponse = Depends(get_current_user)
):
    """Search for stocks by name or symbol"""
    return search_stocks(params.query)