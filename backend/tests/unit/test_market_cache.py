from unittest.mock import patch
import pandas as pd
import pytest
from app.utils import market_cache

def _history(closes):
    dates = pd.bdate_range("2025-01-01", periods=len(closes))
    return pd.DataFrame({"Close": closes}, index=dates)

@patch("app.utils.market_cache.get_cached_price_history")
def test_get_market_returns_uses_vt_ticker_and_one_year_period(mock_price_history):
    mock_price_history.return_value = _history([100.0, 101.0, 99.0])
    market_cache.get_market_returns()
    mock_price_history.assert_called_once_with("VT", period="1y")

@patch("app.utils.market_cache.get_cached_price_history")
def test_get_market_returns_computes_percent_change(mock_price_history):
    mock_price_history.return_value = _history([100.0, 110.0, 99.0])
    returns = market_cache.get_market_returns()

    assert len(returns) == 2
    assert returns.iloc[0] == pytest.approx(0.10)
    assert returns.iloc[1] == pytest.approx((99.0 - 110.0) / 110.0)

@patch("app.utils.market_cache.get_cached_price_history")
def test_get_market_returns_empty_history_returns_empty_series(mock_price_history):
    mock_price_history.return_value = pd.DataFrame()
    returns = market_cache.get_market_returns()

    assert returns.empty
    assert returns.dtype == "float64"

@patch("app.utils.market_cache.get_cached_price_history")
def test_get_market_returns_drops_nan_closes(mock_price_history):
    history = _history([100.0, float("nan"), 105.0])
    mock_price_history.return_value = history
    returns = market_cache.get_market_returns()

    assert not returns.isna().any()