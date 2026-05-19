from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.indicators.capm import calculate_capm
from app.indicators.pe_ratio import calculate_pe_ratio
from app.indicators.altman_z_score import calculate_altman_zscore
from app.indicators.beta import calculate_beta
from app.indicators.rsi import calculate_rsi        
from app.indicators.sharpe_ratio import calculate_sharpe_ratio
from app.indicators.sortino_ratio import calculate_sortino_ratio

router = APIRouter(prefix="/api/indicators", tags=["indicators"])

MOCK_HOLDINGS = [
    {
        "ticker": "NPN", "name": "Naspers",
        "price": 3150.00, "eps": 52.4, "beta": 1.35,
        "working_capital": 12_400_000, "retained_earnings": 45_000_000,
        "ebit": 8_200_000, "market_value_equity": 98_000_000,
        "total_liabilities": 31_000_000, "revenue": 62_000_000,
        "total_assets": 110_000_000, "total_debt": 28_000_000,
        "total_equity": 82_000_000, "net_income": 7_500_000,
        "shareholders_equity": 82_000_000, "portfolio_return": 0.18,
    },
    {
        "ticker": "MTN", "name": "MTN Group",
        "price": 138.00, "eps": 8.2, "beta": 0.95,
        "working_capital": 5_100_000, "retained_earnings": 18_000_000,
        "ebit": 3_400_000, "market_value_equity": 24_000_000,
        "total_liabilities": 14_000_000, "revenue": 31_000_000,
        "total_assets": 45_000_000, "total_debt": 12_000_000,
        "total_equity": 19_000_000, "net_income": 2_800_000,
        "shareholders_equity": 19_000_000, "portfolio_return": 0.12,
    },
]

def safe_calc(fn, stock):
    try:
        return fn(stock)
    except Exception as e:
        return {"status": "error", "reason": str(e)}

@router.get("")
def get_indicators(current_user: UserResponse = Depends(get_current_user)):
    results = []
    for stock in MOCK_HOLDINGS:
        results.append({
            "ticker":   stock["ticker"],
            "name":     stock["name"],
            "capm":     safe_calc(lambda s: calculate_capm(s["risk_free_rate"], s["beta"], s["expected_market_return"]), stock),
            "pe_ratio": safe_calc(lambda s: calculate_pe_ratio(s["price"], s["eps"]), stock),
            "altman_z": safe_calc(lambda s: calculate_altman_zscore(s["working_capital"], s["total_assets"], s["retained_earnings"], s["ebit"], s["market_value_equity"], s["total_liabilities"], s["revenue"]), stock),
            "beta":     safe_calc(lambda s: calculate_beta(s["stock_returns"], s["market_returns"]), stock),
            "rsi":      safe_calc(lambda s: calculate_rsi(s["price_series"]), stock),
            "sharpe":   safe_calc(lambda s: calculate_sharpe_ratio(s["returns"]), stock),
            "sortino":  safe_calc(lambda s: calculate_sortino_ratio(s["portfolio_return"]), stock),
        })
    return results