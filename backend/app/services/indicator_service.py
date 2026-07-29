import pandas as pd
from app.utils.stock_cache import get_cached_fundamentals, get_cached_price_history
from app.services.market_data_service import _cents_to_major
from app.indicators.capm import calculate_capm
from app.indicators.altman_z_score import calculate_altman_zscore
from app.indicators.beta import calculate_beta
from app.indicators.pe_ratio import calculate_pe_ratio
from app.indicators.rsi import calculate_rsi
from app.indicators.sharpe_ratio import calculate_sharpe_ratio
from app.indicators.sortino_ratio import calculate_sortino_ratio

INDICATOR_UNITS = {
    "capm": "%",
    "pe_ratio": "x",
    "altman_z": "",
    "beta": "",
    "rsi": "",
    "sharpe": "",
    "sortino": "",
}

def serialize_indicator_value(value, unit, fallback_reason="Data could not be retrieved."):
    if isinstance(value, dict) and "status" in value:
        return value
    
    if value is None or (isinstance(value,float) and pd.isna(value)):
        return{
            "status": "insufficient_data",
            "reason": fallback_reason,
        }
    return{
        "status": "ok",
        "value": value,
        "unit": unit,
    }

def serialize_indicator_row(row: dict) -> dict:
    normalized = {
        "ticker": row.get("ticker"),
        "name": row.get("name"),
    }

    if row.get("error"):
        for key in INDICATOR_UNITS:
            normalized[key] = {"status": "error"}
        normalized["error"] = row["error"]
        return normalized
    
    for key, unit in INDICATOR_UNITS.items():
        normalized[key] = serialize_indicator_value(row.get(key), unit)
    return normalized

def build_live_indicator_row(symbol: str, name: str, market_returns: pd.Series) -> dict:
    try:
        hist = get_cached_price_history(symbol,period="1y")
        if hist.empty or "Close" not in hist:
            raise ValueError("No price data")
        
        close = hist["Close"].dropna() / _cents_to_major(symbol)
        returns = close.pct_change().dropna()
        # We use 'inner' join here to account for holiday dates where the market would be closed
        # as would lead to length mismatches
        aligned_returns, aligned_market_returns = returns.align(market_returns, join="inner")

        beta = None
        try:
            if len(aligned_returns) > 10 and len(aligned_market_returns) > 10:
                beta = calculate_beta(aligned_returns.values, aligned_market_returns.values)
        except Exception as exc:
            print(f"Beta calculation failed for {symbol}: {exc}")
            beta = None
        
        rsi_value = None
        try:
            if len(close) > 14:
                rsi_value = float(calculate_rsi(close).iloc[-1])
        except Exception as exc:
            print(f"RSI calculation failed for {symbol}: {exc}")
            rsi_value = None
        
        sharpe = None
        try:
            if len(returns) > 10:
                sharpe = calculate_sharpe_ratio(returns.values)
        except Exception as exc:
            print(f"Sharpe calculation failed for {symbol} : {exc}")
            sharpe = None
        
        sortino = None
        try:
            if len(returns) > 10:
                sortino = calculate_sortino_ratio(returns.values)
        except Exception as exc:
            print(f"Sortino calculation failed for {symbol}: {exc}")
            sortino = None

        capm_value = None
        try:
            if beta is not None:
                capm_value = calculate_capm(0.02, beta, 0.08)
        except Exception as exc:
            print(f"CAPM calculation failed for {symbol}: {exc}")
            capm_value = None

        fundamentals = get_cached_fundamentals(symbol)

        info = fundamentals.get("info",{})
        balance_sheet = fundamentals.get("balance_sheet")
        financials = fundamentals.get("financials")

        #Altman Z and PE not applicable to Mutual funds and ETF
        quote_type = (info.get("quoteType") or "").upper()
        is_fund = quote_type in ("ETF", "MUTUALFUND", "INDEX")
        fund_reason = "N/A - financial instrument doesn't report company-level financials."

        #Altman Z is built for retail/industrial companies, therefore Total Revenue is N/A from financial institutions
        sector = (info.get("sector") or "").upper()
        is_financial = sector in ("FINANCIAL SERVICES", "FINANCIALS")
        sector_reason = "N/A - Altman Z Score not meaninful for banks and financial institutions."

        eps = info.get("trailingEps") or info.get("epsTrailingTwelveMonths")
        pe = None
        try:
            if eps is not None and float(eps) > 0:
                pe = calculate_pe_ratio(float(close.iloc[-1]),float(eps))
            else:
                trailing_pe = info.get("trailingPE") or info.get("forwardPE")
                if trailing_pe is not None:
                    pe = float(trailing_pe)
        except Exception as exc:
            print(f"PE Calculation failed for {symbol}: {exc}")
            pe = None

        if pe is None and is_fund:
            pe = {"status": "insufficient_data", "reason": fund_reason}

        altman = None
        try:
            if balance_sheet is not None and not balance_sheet.empty and financials is not None and not financials.empty:
                working_capital = None
                if "Working Capital" in balance_sheet.index:
                    working_capital = float(balance_sheet.loc["Working Capital"].iloc[0])

                total_assets = None
                if "Total Assets" in balance_sheet.index:
                    total_assets = float(balance_sheet.loc["Total Assets"].iloc[0])

                retained_earnings = None
                if "Retained Earnings" in balance_sheet.index:
                    retained_earnings = float(balance_sheet.loc["Retained Earnings"].iloc[0])

                ebit = None
                if "EBIT" in financials.index:
                    ebit = float(financials.loc["EBIT"].iloc[0])

                market_cap = info.get("marketCap")

                total_liabilities = None
                if "Total Liabilities Net Minority Interest" in balance_sheet.index:
                    total_liabilities = float(balance_sheet.loc["Total Liabilities Net Minority Interest"].iloc[0])

                sales = None
                if "Total Revenue" in financials.index:
                    sales = float(financials.loc["Total Revenue"].iloc[0])

                if all(value is not None
                       for value in [working_capital,total_assets,retained_earnings,ebit,market_cap,total_liabilities,sales]):
                    altman = calculate_altman_zscore(working_capital,total_assets,retained_earnings,ebit,market_cap,total_liabilities,sales,)
        except Exception as exc:
            print(f"Altman calculation failed for {symbol}: {exc}")
            altman = None

        if altman is None and is_fund:
            altman = {"status": "insufficient_data", "reason": fund_reason}

        if altman is None and is_financial:
            altman = {"status": "insufficient_data", "reason": sector_reason}
        
        return{
            "ticker": symbol,
            "name": name,
            "capm": capm_value,
            "pe_ratio": pe,
            "altman_z": altman,
            "beta": beta,
            "rsi": rsi_value,
            "sharpe": sharpe,
            "sortino": sortino,
        }
    except Exception as e:
        print(f"build_live_indicator_row failed for {symbol}: {e}")
        return{
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