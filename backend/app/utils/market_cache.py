import pandas as pd
from app.utils.stock_cache import get_cached_price_history

def get_market_returns():
    history = get_cached_price_history("VT", period="1y")
    if history.empty:
        return pd.Series(dtype="float64")
    close = history["Close"].dropna()
    return close.pct_change().dropna()