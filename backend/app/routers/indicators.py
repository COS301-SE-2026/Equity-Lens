# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models.portfolio import Portfolios, Holdings
# from app.dependencies import get_current_user
# from app.schemas.auth import UserResponse
# from app.indicators.capm import calculate_capm
# from app.indicators.pe_ratio import calculate_pe_ratio
# from app.indicators.altman_z_score import calculate_altman_zscore
# from app.indicators.beta import calculate_beta
# from app.indicators.rsi import calculate_rsi        
# from app.indicators.sharpe_ratio import calculate_sharpe_ratio
# from app.indicators.sortino_ratio import calculate_sortino_ratio
# from app.utils.market_cache import get_market_returns
# from app.utils.stock_cache import get_cached_price_history, get_cached_fundamentals
# import pandas as pd

# router = APIRouter(prefix="/api/indicators", tags=["indicators"])

# INDICATOR_UNITS = {
#     "capm": "%",
#     "pe_ratio": "x",
#     "altman_z": "",
#     "beta": "",
#     "rsi": "",
#     "sharpe": "",
#     "sortino": "",
# }

# def _extract_statement_value(statement, *candidate_keys):
#     if statement is None or statement.empty:
#         return None

#     for key in candidate_keys:
#         if key in statement.index:
#             value = statement.loc[key]
#             if hasattr(value, "iloc"):
#                 value = value.iloc[0]
#             try:
#                 return float(value)
#             except (TypeError, ValueError):
#                 return None

#     return None

# def serialize_indicator_value(value, unit, fallback_reason="Data could not be retrieved. Check if ticker is delisted or if Lambda refresh job ran today."):
#     if isinstance(value, dict) and "status" in value:
#         return value

#     if value is None or (isinstance(value, float) and pd.isna(value)):
#         return {
#             "status": "insufficient_data",
#             "reason": fallback_reason,
#         }

#     return {
#         "status": "ok",
#         "value": value,
#         "unit": unit,
#     }

# def serialize_indicator_row(row: dict) -> dict:
#     normalized = {
#         "ticker": row.get("ticker"),
#         "name": row.get("name"),
#     }

#     if row.get("error"):
#         for key in INDICATOR_UNITS:
#             normalized[key] = {"status": "error"}
#         normalized["error"] = row["error"]
#         return normalized

#     for key, unit in INDICATOR_UNITS.items():
#         normalized[key] = serialize_indicator_value(row.get(key), unit)

#     return normalized

# def build_live_indicator_row(symbol: str, name: str, market_returns: pd.Series) -> dict:
#     try:
#         hist = get_cached_price_history(symbol,period="1y")
#         if hist.empty or "Close" not in hist:
#             raise ValueError("no price data")

#         close = hist["Close"].dropna()
#         returns = close.pct_change().dropna()
#         # We use 'inner' join here to drop dates where either the stock or the market
#         # was closed (e.g., NYSE holiday vs London holiday). Without this, Beta
#         # calculation would fail due to mismatched lengths.
#         returns, market_returns = returns.align(market_returns, join="inner")

#         beta = None
#         if len(returns) > 10 and len(market_returns) > 10:
#             beta = calculate_beta(returns.values, market_returns.values)

#         rsi_val = None
#         if len(close) > 14:
#             rsi_val = float(calculate_rsi(close).iloc[-1])

#         sharpe = float(calculate_sharpe_ratio(returns.values)) if len(returns) > 10 else None
#         sortino = float(calculate_sortino_ratio(returns.values)) if len(returns) > 10 else None
#         capm_val = calculate_capm(0.02, beta, 0.08) if beta is not None else None

#         fundamentals = get_cached_fundamentals(symbol)

#         info = fundamentals.get("info",{})
#         balance_sheet = fundamentals.get("balance_sheet")
#         financials = fundamentals.get("financials")

#         eps = info.get("trailingEps") or info.get("epsTrailingTwelveMonths")
#         pe = None
#         if eps is not None and float(eps) != 0:
#             pe = calculate_pe_ratio(float(close.iloc[-1]), float(eps))

#         altman = None
#         try:
#             if balance_sheet is not None and financials is not None and not balance_sheet.empty and not financials.empty:
#                 current_assets = _extract_statement_value(
#                     balance_sheet,
#                     "currentAssets",
#                     "totalCurrentAssets",
#                 )
#                 current_liabilities = _extract_statement_value(
#                     balance_sheet,
#                     "currentLiabilities",
#                     "totalCurrentLiabilities",
#                 )
#                 working_capital = None
#                 if current_assets is not None and current_liabilities is not None:
#                     working_capital = current_assets - current_liabilities

#                 retained_earnings = _extract_statement_value(
#                     balance_sheet,
#                     "retainedEarnings",
#                     "retainedEarningsAccumulatedDeficit",
#                     "retainedEarningsTotalEquity",
#                 )
#                 total_assets = _extract_statement_value(
#                     balance_sheet,
#                     "totalAssets",
#                     "totalAssetsReported",
#                 )
#                 total_liabilities = _extract_statement_value(
#                     balance_sheet,
#                     "totalLiab",
#                     "totalLiabilitiesNetMinorityInterest",
#                     "totalLiabilities",
#                 )
#                 ebit = _extract_statement_value(
#                     financials,
#                     "ebit",
#                     "operatingIncome",
#                 )
#                 sales = _extract_statement_value(
#                     financials,
#                     "totalRevenue",
#                     "revenue",
#                 )
#                 market_cap = info.get("marketCap")

#                 if all(
#                     value is not None
#                     for value in [
#                         working_capital,
#                         total_assets,
#                         retained_earnings,
#                         ebit,
#                         market_cap,
#                         total_liabilities,
#                         sales,
#                     ]
#                 ):
#                     altman = calculate_altman_zscore(
#                         working_capital,
#                         total_assets,
#                         retained_earnings,
#                         ebit,
#                         market_cap,
#                         total_liabilities,
#                         sales,
#                     )
#         except Exception:
#             altman = None

#         return {
#             "ticker": symbol,
#             "name": name,
#             "capm": capm_val,
#             "pe_ratio": pe,
#             "altman_z": altman,
#             "beta": beta,
#             "rsi": rsi_val,
#             "sharpe": sharpe,
#             "sortino": sortino,
#         }
#     except Exception as e:
#         return {
#             "ticker": symbol,
#             "name": name,
#             "error": str(e),
#             "capm": None,
#             "pe_ratio": None,
#             "altman_z": None,
#             "beta": None,
#             "rsi": None,
#             "sharpe": None,
#             "sortino": None,
#         }

# @router.get("")
# def get_indicators(current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db)):
#     portfolios = db.query(Portfolios).filter(Portfolios.user_id == current_user.id).all()
#     # NOTE: We are filtering out tickers that are empty strings or null.
#     # However, we decided NOT to filter out tickers with less than 1 year of history
#     # here because the build_live_indicator_row function handles that gracefully
#     # and returns a "insufficient_data" status for those specific tickers.
#     portfolio_ids = [p.id for p in portfolios]

#     if not portfolio_ids:
#         return []

#     tickers = []
#     ticker_to_name = {}

#     market_returns = get_market_returns()
    
#     holdings = db.query(Holdings).filter(Holdings.portfolio_id.in_(portfolio_ids)).all()

#     for h in holdings: 
#         ticker = (h.ticker or "").strip()
#         if not ticker:
#             continue
#         if ticker not in tickers:
#             tickers.append(ticker)
#             display_name = (h.instrument_name or ticker)
#             ticker_to_name[ticker] = display_name

#     if not tickers:
#         return []
    
#     results = []

#     for t in tickers:
#         name = ticker_to_name.get(t, t)
#         row = build_live_indicator_row(t,name,market_returns)
#         results.append(serialize_indicator_row(row))

#     return results