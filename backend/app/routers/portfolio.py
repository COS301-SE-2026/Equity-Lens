from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

MOCK_PORTFOLIO = {
    "summary": {
        "totalValue": 125430.50,
        "totalCost": 98200.00,
        "totalGain": 27230.50,
        "totalGainPercent": 27.73,
        "holdingsCount": 8,
    },
    "holdings": [
        {
            "ticker": "NPN",
            "name": "Naspers",
            "quantity": 10,
            "purchasePrice": 2800,
            "currentPrice": 3150,
            "value": 31500,
            "gain": 3500,
            "gainPercent": 12.5,
            "sector": "Technology",
        },
        {
            "ticker": "MTN",
            "name": "MTN Group",
            "quantity": 50,
            "purchasePrice": 120,
            "currentPrice": 138,
            "value": 6900,
            "gain": 900,
            "gainPercent": 15.0,
            "sector": "Telecommunications",
        },
    ],
    "sectorAllocation": [
        {"sector": "Technology", "value": 31500, "percentage": 25.1},
        {"sector": "Financials", "value": 27240, "percentage": 21.7},
        {"sector": "Mining", "value": 20050, "percentage": 16.0},
        {"sector": "Telecommunications", "value": 6900, "percentage": 5.5},
        {"sector": "Energy", "value": 7350, "percentage": 5.9},
    ],
    "performanceHistory": [
        {"date": "2024-01", "value": 98200},
        {"date": "2024-06", "value": 112300},
        {"date": "2024-12", "value": 125430},
    ],
}


@router.get("")
def get_portfolio(current_user: UserResponse = Depends(get_current_user)):
    return MOCK_PORTFOLIO


@router.get("/summary")
def get_summary(current_user: UserResponse = Depends(get_current_user)):
    return MOCK_PORTFOLIO["summary"]


@router.get("/sectors")
def get_sectors(current_user: UserResponse = Depends(get_current_user)):
    return MOCK_PORTFOLIO["sectorAllocation"]


@router.get("/performance")
def get_performance(current_user: UserResponse = Depends(get_current_user)):
    return MOCK_PORTFOLIO["performanceHistory"]