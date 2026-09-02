from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, PropertyMock
import pandas as pd
import pytest
from app.utils import stock_cache

MOCK_TICKER = "NPN"
MOCK_DATE_STR = "2026-03-31"

def _make_history(volume, prev_close=None, close=145.26):
    return pd.DataFrame(
        {
            "Open": [144.0], "High": [146.0], "Low": [143.0], "Close": [close],
            "Volume": [volume],
            "Prev Close": [prev_close if prev_close is not None else float("nan")],
        },
        index=pd.DatetimeIndex([pd.Timestamp("2026-03-04")]),
    )

def _good_history():
    return pd.DataFrame(
        {"Open": [1], "High": [1], "Low": [1], "Close": [1], "Volume": [1]},
        index=pd.DatetimeIndex([pd.Timestamp("2026-01-01")]),
    )

def setup_function():
    stock_cache._FUNDAMENTALS_RATE_LIMITED_UNTIL.clear()
    stock_cache._PRICE_REFRESH_COOLDOWN_UNTIL.clear()
    stock_cache._REFRESH_LOCKS.clear()
    stock_cache._YFINANCE_GLOBAL_COOLDOWN_UNTIL = None
    stock_cache._YFINANCE_COOLDOWN_STRIKES = 0

def test_should_refresh_market_data_none_always_refreshes():
    assert stock_cache.should_refresh_market_data(None, ttl_hours=24) is True
 
def test_should_refresh_market_data_within_ttl_hours_does_not_refresh():
    recent = datetime.now(timezone.utc) - timedelta(hours=1)
 
    assert stock_cache.should_refresh_market_data(recent, ttl_hours=24) is False
 
def test_should_refresh_market_data_past_ttl_refreshes():
    stale = datetime.now(timezone.utc) - timedelta(hours=25)
 
    assert stock_cache.should_refresh_market_data(stale, ttl_hours=24) is True
 
def test_should_refresh_market_data_string_timestamp_is_parsed():
    recent_iso = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat().replace("+00:00", "Z")
 
    assert stock_cache.should_refresh_market_data(recent_iso, ttl_hours=24) is False
 
def test_should_refresh_market_data_fundamentals_weekly_ttl_boundary():
    just_under = datetime.now(timezone.utc) - timedelta(hours=(24 * 7) - 1)
    just_over = datetime.now(timezone.utc) - timedelta(hours=(24 * 7) + 1)
 
    assert stock_cache.should_refresh_market_data(just_under, ttl_hours=stock_cache.FUNDAMENTALS_TTL_HOURS) is False
    assert stock_cache.should_refresh_market_data(just_over, ttl_hours=stock_cache.FUNDAMENTALS_TTL_HOURS) is True
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_price_history_nan_volume_becomes_zero(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
 
    stock_cache._save_price_history(MOCK_TICKER, _make_history(volume=float("nan")))
 
    added_obj = mock_db.add.call_args[0][0]
    assert added_obj.volume == 0.0
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_price_history_nan_prev_close_falls_back_to_close(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
 
    stock_cache._save_price_history(MOCK_TICKER, _make_history(volume=100.0, prev_close=None, close=150.0))
 
    added_obj = mock_db.add.call_args[0][0]
    assert added_obj.prev_close == 150.0
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_price_history_empty_dataframe_is_a_noop(mock_session_local):
    stock_cache._save_price_history(MOCK_TICKER, pd.DataFrame())
    mock_session_local.assert_not_called()
  
@patch("app.utils.stock_cache.yf.Ticker")
def test_fetch_from_yfinance_tries_jo_suffix_first(mock_ticker_cls):
    mock_instance = MagicMock()
    mock_instance.history.return_value = _good_history()
    mock_ticker_cls.return_value = mock_instance
 
    stock_cache._fetch_from_yfinance(MOCK_TICKER, period="1y")
 
    mock_ticker_cls.assert_called_once_with(f"{MOCK_TICKER}.JO")
 
@patch("app.utils.stock_cache.yf.Ticker")
def test_fetch_from_yfinance_falls_back_to_plain_ticker_if_jo_empty(mock_ticker_cls):
    jo_instance = MagicMock()
    jo_instance.history.return_value = pd.DataFrame()
    plain_instance = MagicMock()
    plain_instance.history.return_value = _good_history()
    mock_ticker_cls.side_effect = [jo_instance, plain_instance]
 
    result = stock_cache._fetch_from_yfinance(MOCK_TICKER, period="1y")
 
    assert mock_ticker_cls.call_args_list[0][0] == (f"{MOCK_TICKER}.JO",)
    assert mock_ticker_cls.call_args_list[1][0] == (MOCK_TICKER,)
    assert not result.empty
 
@patch("app.utils.stock_cache.yf.Ticker")
def test_fetch_from_yfinance_both_candidates_failing_returns_empty(mock_ticker_cls):
    mock_instance = MagicMock()
    mock_instance.history.side_effect = Exception("No data found, symbol may be delisted")
    mock_ticker_cls.return_value = mock_instance
 
    result = stock_cache._fetch_from_yfinance(MOCK_TICKER, period="1y")
 
    assert result.empty
  
@patch("app.utils.stock_cache._load_cached_fundamentals", return_value=None)
@patch("app.utils.stock_cache.yf.Ticker")
def test_get_cached_fundamentals_skips_fetch_during_cooldown(mock_ticker_cls, _mock_cache):
    stock_cache._FUNDAMENTALS_RATE_LIMITED_UNTIL[MOCK_TICKER] = datetime.now(timezone.utc) + timedelta(minutes=5)
 
    with patch.object(stock_cache.settings, "allow_live_market_fallback", True):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
 
    mock_ticker_cls.assert_not_called()
    assert result["balance_sheet"].empty
    assert result["live_fetch"] is False
 
@patch("app.utils.stock_cache._load_cached_fundamentals", return_value=None)
@patch("app.utils.stock_cache._save_fundamentals")
@patch("app.utils.stock_cache.yf.Ticker")
def test_get_cached_fundamentals_rate_limit_stops_second_candidate(mock_ticker_cls, _mock_save, _mock_cache):
    mock_instance = MagicMock()
    type(mock_instance).info = PropertyMock(
        side_effect=Exception("Too Many Requests. Rate limited. Try after a while.")
    )
    mock_ticker_cls.return_value = mock_instance
 
    with patch.object(stock_cache.settings, "allow_live_market_fallback", True):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
 
    assert mock_ticker_cls.call_count == 1
    assert MOCK_TICKER in stock_cache._FUNDAMENTALS_RATE_LIMITED_UNTIL
    assert result["live_fetch"] is True
 
@patch("app.utils.stock_cache._load_cached_fundamentals")
def test_get_cached_fundamentals_cache_hit_skips_live_fetch(mock_load_cached):
    mock_load_cached.return_value = {
        "info": {"sector": "Technology"},
        "balance_sheet": pd.DataFrame({"2026-03-31": {"Total Assets": 100}}),
        "financials": pd.DataFrame(),
    }
    with patch.object(stock_cache.settings, "allow_live_market_fallback", True), \
         patch("app.utils.stock_cache.yf.Ticker") as mock_ticker_cls:
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
        mock_ticker_cls.assert_not_called()
    assert result["info"]["sector"] == "Technology"
    assert result["live_fetch"] is False
 
def test_get_cached_fundamentals_fallback_disabled_skips_everything():
    with patch.object(stock_cache.settings, "allow_live_market_fallback", False), \
         patch("app.utils.stock_cache.yf.Ticker") as mock_ticker_cls:
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
        mock_ticker_cls.assert_not_called()
    assert result["info"] == {}
 
@patch("app.utils.stock_cache.requests.get")
def test_fetch_from_alpha_vantage_parses_daily_series(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "Time Series (Daily)": {
            "2026-03-04": {"1. open": "144.0", "2. high": "146.0", "3. low": "143.0",
                            "4. close": "145.0", "6. volume": "1000"},
            "2026-03-05": {"1. open": "145.0", "2. high": "147.0", "3. low": "144.0",
                            "4. close": "146.0", "6. volume": "1200"},
        }
    }
    mock_get.return_value = mock_response
    result = stock_cache._fetch_from_alpha_vantage(MOCK_TICKER)
 
    assert len(result) == 2
    assert result["Close"].iloc[0] == 145.0
    assert result["Prev Close"].iloc[1] == 145.0
 
@patch("app.utils.stock_cache.requests.get")
def test_fetch_from_alpha_vantage_raises_on_empty_series(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = {"Note": "Rate limit exceeded"}
    mock_get.return_value = mock_response
 
    with pytest.raises(ValueError, match="Rate limit exceeded"):
        stock_cache._fetch_from_alpha_vantage(MOCK_TICKER)
 
@patch("app.utils.stock_cache._load_local_price_history")
@patch("app.utils.stock_cache._save_price_history")
@patch("app.utils.stock_cache._fetch_from_alpha_vantage")
def test_refresh_price_history_uses_alpha_vantage_when_key_present(mock_fetch_av, mock_save, mock_load_local):
    mock_fetch_av.return_value = _good_history()
    mock_load_local.return_value = _good_history()
 
    with patch.object(stock_cache.settings, "alpha_vantage_api_key", "fake-key"):
        result = stock_cache._refresh_price_history(MOCK_TICKER, "1y")
 
    mock_fetch_av.assert_called_once_with(MOCK_TICKER)
    assert not result.empty
 
@patch("app.utils.stock_cache._load_local_price_history")
@patch("app.utils.stock_cache._save_price_history")
@patch("app.utils.stock_cache._fetch_from_yfinance")
@patch("app.utils.stock_cache._fetch_from_alpha_vantage", side_effect=Exception("quota exceeded"))
def test_refresh_price_history_falls_back_to_yahoo_when_alpha_vantage_fails(
    mock_fetch_av, mock_fetch_yf, mock_save, mock_load_local
):
    mock_fetch_yf.return_value = _good_history()
    mock_load_local.return_value = _good_history()
 
    with patch.object(stock_cache.settings, "alpha_vantage_api_key", "fake-key"), \
         patch.object(stock_cache.settings, "allow_live_market_fallback", True):
        result = stock_cache._refresh_price_history(MOCK_TICKER, "1y")
 
    mock_fetch_yf.assert_called_once_with(MOCK_TICKER, "1y")
    assert not result.empty
 
def test_refresh_price_history_returns_empty_when_all_sources_fail():
    with patch.object(stock_cache.settings, "alpha_vantage_api_key", None), \
         patch.object(stock_cache.settings, "allow_live_market_fallback", False):
        result = stock_cache._refresh_price_history(MOCK_TICKER, "1y")
 
    assert result.empty
 
@patch("app.utils.stock_cache.should_refresh_market_data", return_value=False)
@patch("app.utils.stock_cache.SessionLocal")
@patch("app.utils.stock_cache._load_local_price_history")
def test_get_cached_price_history_returns_local_cache_when_fresh(
    mock_load_local, mock_session_local, _mock_should_refresh
):
    mock_load_local.return_value = _good_history()
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = MagicMock(
        fetched_at=datetime.now(timezone.utc), date=datetime.now(timezone.utc).date(),
    )
 
    with patch("app.utils.stock_cache._refresh_price_history") as mock_refresh:
        result = stock_cache.get_cached_price_history(MOCK_TICKER)
        mock_refresh.assert_not_called()
 
    assert not result.empty
 
@patch("app.utils.stock_cache.should_refresh_market_data", return_value=True)
@patch("app.utils.stock_cache.SessionLocal")
@patch("app.utils.stock_cache._load_local_price_history")
@patch("app.utils.stock_cache._refresh_price_history")
def test_get_cached_price_history_refreshes_when_stale(
    mock_refresh, mock_load_local, mock_session_local, _mock_should_refresh
):
    mock_load_local.return_value = _good_history()
    mock_refresh.return_value = _good_history()
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = MagicMock(
        fetched_at=datetime.now(timezone.utc) - timedelta(days=2)
    )
    stock_cache.get_cached_price_history(MOCK_TICKER)
 
    mock_refresh.assert_called_once()
 
@patch("app.utils.stock_cache.SessionLocal")
def test_load_cached_fundamentals_returns_none_when_no_row(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
 
    assert stock_cache._load_cached_fundamentals(MOCK_TICKER) is None
 
@patch("app.utils.stock_cache.SessionLocal")
def test_load_cached_fundamentals_returns_none_when_stale(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    stale_row = MagicMock(fetched_at=datetime.now(timezone.utc) - timedelta(days=30))
    mock_db.query.return_value.filter.return_value.first.return_value = stale_row
 
    assert stock_cache._load_cached_fundamentals(MOCK_TICKER) is None
 
@patch("app.utils.stock_cache.SessionLocal")
def test_load_cached_fundamentals_rebuilds_dataframes_from_json(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    fresh_row = MagicMock(
        fetched_at=datetime.now(timezone.utc),
        info={"sector": "Technology"},
        balance_sheet={"2026-03-31": {"Total Assets": 500.0}},
        financials={"2026-03-31": {"EBIT": 60.0}},
    )
    mock_db.query.return_value.filter.return_value.first.return_value = fresh_row
    result = stock_cache._load_cached_fundamentals(MOCK_TICKER)
 
    assert result["info"]["sector"] == "Technology"
    assert result["balance_sheet"].loc["Total Assets"].iloc[0] == 500.0
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_fundamentals_converts_timestamp_columns_to_strings(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
    balance_sheet = pd.DataFrame({pd.Timestamp("2026-03-31"): {"Total Assets": 500.0}})
    financials = pd.DataFrame({pd.Timestamp("2026-03-31"): {"EBIT": 60.0}})
    stock_cache._save_fundamentals(MOCK_TICKER, {"sector": "Technology"}, balance_sheet, financials)
    added_obj = mock_db.add.call_args[0][0]

    assert all(isinstance(k, str) for k in added_obj.balance_sheet.keys())
    assert added_obj.info == {"sector": "Technology"}
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_fundamentals_converts_nan_to_none_for_json_safety(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
    balance_sheet = pd.DataFrame({pd.Timestamp("2026-03-31"): {"Total Assets": float("nan")}})
    stock_cache._save_fundamentals(MOCK_TICKER, {}, balance_sheet, pd.DataFrame())
    added_obj = mock_db.add.call_args[0][0]
    col_key = next(iter(added_obj.balance_sheet.keys()))

    assert added_obj.balance_sheet[col_key]["Total Assets"] is None
 
@patch("app.utils.stock_cache.SessionLocal")
def test_save_fundamentals_empty_dataframes_store_none(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
    stock_cache._save_fundamentals(MOCK_TICKER, {"sector": "Technology"}, pd.DataFrame(), pd.DataFrame())
    added_obj = mock_db.add.call_args[0][0]

    assert added_obj.balance_sheet is None
    assert added_obj.financials is None
 
@patch("app.utils.stock_cache._load_cached_fundamentals", return_value=None)
@patch("app.utils.stock_cache._save_fundamentals")
@patch("app.utils.stock_cache.yf.Ticker")
def test_get_cached_fundamentals_successful_jo_fetch_saves_and_returns_data(
    mock_ticker_cls, mock_save, _mock_cache
):
    mock_instance = MagicMock()
    mock_instance.info = {"sector": "Technology", "trailingEps": 5.0}
    mock_instance.balance_sheet = pd.DataFrame({"2026-03-31": {"Total Assets": 500.0}})
    mock_instance.financials = pd.DataFrame({"2026-03-31": {"EBIT": 60.0}})
    mock_ticker_cls.return_value = mock_instance
    with patch.object(stock_cache.settings, "allow_live_market_fallback", True):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
    mock_ticker_cls.assert_called_once_with("NPN.JO")
    mock_save.assert_called_once()

    assert result["info"]["sector"] == "Technology"
    assert result["live_fetch"] is True