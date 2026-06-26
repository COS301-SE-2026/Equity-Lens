from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.portfolio import Portfolios, Holdings
import yfinance as yf
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


def safe_calc(fn, stock):
    try:
        return fn(stock)
    except Exception as e:
        return {"status": "error", "reason": str(e)}

def build_live_indicator_row(symbol: str, name: str) -> dict:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y", interval="1d", auto_adjust=True)
        if hist.empty or "Close" not in hist:
            raise ValueError("no price data")

        close = hist["Close"].dropna()
        returns = close.pct_change().dropna()

        market_hist = yf.Ticker("^GSPC").history(period="1y", interval="1d", auto_adjust=True)
        market_close = market_hist["Close"].dropna()
        market_returns = market_close.pct_change().dropna()

        returns, market_returns = returns.align(market_returns, join="inner")

        beta = None
        if len(returns) > 10 and len(market_returns) > 10:
            beta = calculate_beta(returns.values, market_returns.values)

        rsi_val = None
        if len(close) > 14:
            rsi_val = float(calculate_rsi(close).iloc[-1])

        sharpe = float(calculate_sharpe_ratio(returns.values)) if len(returns) > 10 else None
        sortino = float(calculate_sortino_ratio(returns.values)) if len(returns) > 10 else None
        capm_val = calculate_capm(0.02, beta, 0.08) if beta is not None else None

        info = getattr(ticker, "info", {}) or {}
        eps = info.get("trailingEps") or info.get("epsTrailingTwelveMonths")
        pe = None
        if eps is not None and float(eps) != 0:
            pe = calculate_pe_ratio(float(close.iloc[-1]), float(eps))

        altman = None
        try:
            balance_sheet = getattr(ticker, "balance_sheet", None)
            financials = getattr(ticker, "financials", None)
            if balance_sheet is not None and financials is not None and not balance_sheet.empty and not financials.empty:
                total_assets = balance_sheet.loc["totalAssets"].iloc[0] if "totalAssets" in balance_sheet.index else None
                total_liabilities = balance_sheet.loc["totalLiab"].iloc[0] if "totalLiab" in balance_sheet.index else None
                working_capital = None
                retained_earnings = None
                ebit = financials.loc["ebit"].iloc[0] if "ebit" in financials.index else None
                sales = financials.loc["totalRevenue"].iloc[0] if "totalRevenue" in financials.index else None
                market_cap = info.get("marketCap")

                if all(
                    value is not None
                    for value in [
                        working_capital,
                        total_assets,
                        retained_earnings,
                        ebit,
                        market_cap,
                        total_liabilities,
                        sales,
                    ]
                ):
                    altman = calculate_altman_zscore(
                        working_capital,
                        total_assets,
                        retained_earnings,
                        ebit,
                        market_cap,
                        total_liabilities,
                        sales,
                    )
        except Exception:
            altman = None

        return {
            "ticker": symbol,
            "name": name,
            "capm": capm_val,
            "pe_ratio": pe,
            "altman_z": altman,
            "beta": beta,
            "rsi": rsi_val,
            "sharpe": sharpe,
            "sortino": sortino,
        }
    except Exception as e:
        return {
            "ticker": symbol,
            "name": name,
            "error": str(e),
            "capm": None,
            "pe_ratio": None,
            "altman_z": None,
            "beta": None,
            "rsi": None,
            "sharpe": None,
            "sortino": None,
        }

@router.get("")
def get_indicators(current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolios = db.query(Portfolios).filter(Portfolios.user_id == current_user.id).all()

    tickers = []
    for p in portfolios:
        holdings = db.query(Holdings).filter(Holdings.portfolio_id == p.id).all()
        for h in holdings:
            symbol = (h.instrument_name or "").strip()
            if symbol and symbol not in tickers:
                tickers.append(symbol)
    results = []
    for t in tickers:
        row = build_live_indicator_row(t,t)
        results.append(row)
    return results