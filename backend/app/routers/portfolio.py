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
            "daily_change_pct": 1.4,
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
            "daily_change_pct": -0.8,
        },
        {
            "ticker": "SOL",
            "name": "Sasol",
            "quantity": 30,
            "purchasePrice": 280,
            "currentPrice": 245,
            "value": 7350,
            "gain": -1050,
            "gainPercent": -12.5,
            "sector": "Energy",
            "daily_change_pct": -2.1,
        },
        {
            "ticker": "FSR",
            "name": "Firstrand",
            "quantity": 100,
            "purchasePrice": 65,
            "currentPrice": 72,
            "value": 7200,
            "gain": 700,
            "gainPercent": 10.8,
            "sector": "Financials",
            "daily_change_pct": 0.6,
        },
        {
            "ticker": "AGL",
            "name": "Anglo American",
            "quantity": 20,
            "purchasePrice": 550,
            "currentPrice": 620,
            "value": 12400,
            "gain": 1400,
            "gainPercent": 12.7,
            "sector": "Mining",
            "daily_change_pct": 0.9,
        },
        {
            "ticker": "SBK",
            "name": "Standard Bank",
            "quantity": 80,
            "purchasePrice": 155,
            "currentPrice": 178,
            "value": 14240,
            "gain": 1840,
            "gainPercent": 14.8,
            "sector": "Financials",
            "daily_change_pct": 1.1,
        },
        {
            "ticker": "BHP",
            "name": "BHP Group",
            "quantity": 15,
            "purchasePrice": 480,
            "currentPrice": 510,
            "value": 7650,
            "gain": 450,
            "gainPercent": 6.3,
            "sector": "Mining",
            "daily_change_pct": 0.3,
        },
        {
            "ticker": "REM",
            "name": "Remgro",
            "quantity": 40,
            "purchasePrice": 130,
            "currentPrice": 145,
            "value": 5800,
            "gain": 600,
            "gainPercent": 11.5,
            "sector": "Financials",
            "daily_change_pct": -0.4,
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
        {"name": "Jan", "value": 98200,  "benchmark": 72000},
        {"name": "Feb", "value": 100000, "benchmark": 73000},
        {"name": "Mar", "value": 99000,  "benchmark": 73500},
        {"name": "Apr", "value": 103000, "benchmark": 75000},
        {"name": "May", "value": 107000, "benchmark": 74500},
        {"name": "Jun", "value": 112300, "benchmark": 77000},
        {"name": "Jul", "value": 111000, "benchmark": 78500},
        {"name": "Aug", "value": 114000, "benchmark": 80000},
        {"name": "Sep", "value": 112000, "benchmark": 78000},
        {"name": "Oct", "value": 117000, "benchmark": 81000},
        {"name": "Nov", "value": 121000, "benchmark": 83000},
        {"name": "Dec", "value": 125430, "benchmark": 85000},
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