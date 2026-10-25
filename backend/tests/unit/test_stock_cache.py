from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock, PropertyMock, patch

import pandas as pd
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models.market_data import MarketData
from app.services import portfolio_service
from app.services.instruments import REGION_SA, REGION_US
from app.utils import stock_cache

MOCK_TICKER = "NPN"
MOCK_DATE_STR = "2026-03-31"


def _make_history(volume, prev_close=None, close=145.26):
    return pd.DataFrame(
        {
            "Open": [144.0],
            "High": [146.0],
            "Low": [143.0],
            "Close": [close],
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
    stock_cache._HISTORY_DEPTH_COOLDOWN_UNTIL.clear()
    stock_cache._YFINANCE_GLOBAL_COOLDOWN_UNTIL = None
    stock_cache._YFINANCE_COOLDOWN_STRIKES = 0


def test_should_refresh_market_data_none_always_refreshes():
    assert stock_cache.should_refresh_market_data(None, ttl_hours=24) is True


def test_should_refresh_market_data_within_ttl_hours_does_not_refresh():
    recent = datetime.now(UTC) - timedelta(hours=1)

    assert stock_cache.should_refresh_market_data(recent, ttl_hours=24) is False


def test_should_refresh_market_data_past_ttl_refreshes():
    stale = datetime.now(UTC) - timedelta(hours=25)

    assert stock_cache.should_refresh_market_data(stale, ttl_hours=24) is True


def test_should_refresh_market_data_string_timestamp_is_parsed():
    recent_iso = (datetime.now(UTC) - timedelta(hours=1)).isoformat().replace("+00:00", "Z")

    assert stock_cache.should_refresh_market_data(recent_iso, ttl_hours=24) is False


def test_should_refresh_market_data_fundamentals_weekly_ttl_boundary():
    just_under = datetime.now(UTC) - timedelta(hours=(24 * 7) - 1)
    just_over = datetime.now(UTC) - timedelta(hours=(24 * 7) + 1)

    assert (
        stock_cache.should_refresh_market_data(
            just_under, ttl_hours=stock_cache.FUNDAMENTALS_TTL_HOURS
        )
        is False
    )
    assert (
        stock_cache.should_refresh_market_data(
            just_over, ttl_hours=stock_cache.FUNDAMENTALS_TTL_HOURS
        )
        is True
    )


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

    stock_cache._save_price_history(
        MOCK_TICKER, _make_history(volume=100.0, prev_close=None, close=150.0)
    )

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
    stock_cache._FUNDAMENTALS_RATE_LIMITED_UNTIL[MOCK_TICKER] = datetime.now(UTC) + timedelta(
        minutes=5
    )

    with patch.object(stock_cache.settings, "allow_live_market_fallback", True):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)

    mock_ticker_cls.assert_not_called()
    assert result["balance_sheet"].empty
    assert result["live_fetch"] is False


@patch("app.utils.stock_cache._load_cached_fundamentals", return_value=None)
@patch("app.utils.stock_cache._save_fundamentals")
@patch("app.utils.stock_cache.yf.Ticker")
def test_get_cached_fundamentals_rate_limit_stops_second_candidate(
    mock_ticker_cls, _mock_save, _mock_cache
):
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
    with (
        patch.object(stock_cache.settings, "allow_live_market_fallback", True),
        patch("app.utils.stock_cache.yf.Ticker") as mock_ticker_cls,
    ):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
        mock_ticker_cls.assert_not_called()
    assert result["info"]["sector"] == "Technology"
    assert result["live_fetch"] is False


def test_get_cached_fundamentals_fallback_disabled_skips_everything():
    with (
        patch.object(stock_cache.settings, "allow_live_market_fallback", False),
        patch("app.utils.stock_cache.yf.Ticker") as mock_ticker_cls,
    ):
        result = stock_cache.get_cached_fundamentals(MOCK_TICKER)
        mock_ticker_cls.assert_not_called()
    assert result["info"] == {}


@patch("app.utils.stock_cache.requests.get")
def test_fetch_from_alpha_vantage_parses_daily_series(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "Time Series (Daily)": {
            "2026-03-04": {
                "1. open": "144.0",
                "2. high": "146.0",
                "3. low": "143.0",
                "4. close": "145.0",
                "6. volume": "1000",
            },
            "2026-03-05": {
                "1. open": "145.0",
                "2. high": "147.0",
                "3. low": "144.0",
                "4. close": "146.0",
                "6. volume": "1200",
            },
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
def test_refresh_price_history_uses_alpha_vantage_when_key_present(
    mock_fetch_av, _mock_save, mock_load_local
):
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
    _mock_fetch_av, mock_fetch_yf, _mock_save, mock_load_local
):
    mock_fetch_yf.return_value = _good_history()
    mock_load_local.return_value = _good_history()

    with (
        patch.object(stock_cache.settings, "alpha_vantage_api_key", "fake-key"),
        patch.object(stock_cache.settings, "allow_live_market_fallback", True),
    ):
        result = stock_cache._refresh_price_history(MOCK_TICKER, "1y")

    mock_fetch_yf.assert_called_once_with(MOCK_TICKER, "1y")
    assert not result.empty


def test_refresh_price_history_returns_empty_when_all_sources_fail():
    with (
        patch.object(stock_cache.settings, "alpha_vantage_api_key", None),
        patch.object(stock_cache.settings, "allow_live_market_fallback", False),
    ):
        result = stock_cache._refresh_price_history(MOCK_TICKER, "1y")

    assert result.empty


def _latest(fetched_at=None, days_old=0):
    return stock_cache.LatestClose(
        date=datetime.now(UTC).date() - timedelta(days=days_old),
        close=1.0,
        prev_close=1.0,
        volume=1,
        fetched_at=fetched_at or datetime.now(UTC),
    )


@patch("app.utils.stock_cache.should_refresh_market_data", return_value=False)
@patch("app.utils.stock_cache.get_latest_close")
@patch("app.utils.stock_cache._load_local_price_history")
def test_get_cached_price_history_returns_local_cache_when_fresh(
    mock_load_local, mock_latest, _mock_should_refresh
):
    mock_load_local.return_value = _good_history()
    mock_latest.return_value = _latest()

    with patch("app.utils.stock_cache._refresh_price_history") as mock_refresh:
        result = stock_cache.get_cached_price_history(MOCK_TICKER)
        mock_refresh.assert_not_called()

    assert not result.empty


@patch("app.utils.stock_cache.should_refresh_market_data", return_value=True)
@patch("app.utils.stock_cache.get_latest_close")
@patch("app.utils.stock_cache._load_local_price_history")
@patch("app.utils.stock_cache._refresh_price_history")
def test_get_cached_price_history_refreshes_when_stale(
    mock_refresh, mock_load_local, mock_latest, _mock_should_refresh
):
    mock_load_local.return_value = _good_history()
    mock_refresh.return_value = _good_history()
    mock_latest.return_value = _latest(fetched_at=datetime.now(UTC) - timedelta(days=2))
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
    stale_row = MagicMock(fetched_at=datetime.now(UTC) - timedelta(days=30))
    mock_db.query.return_value.filter.return_value.first.return_value = stale_row

    assert stock_cache._load_cached_fundamentals(MOCK_TICKER) is None


@patch("app.utils.stock_cache.SessionLocal")
def test_load_cached_fundamentals_rebuilds_dataframes_from_json(mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    fresh_row = MagicMock(
        fetched_at=datetime.now(UTC),
        info={"sector": "Technology"},
        balance_sheet={"2026-03-31": {"Total Assets": 500.0}},
        financials={"2026-03-31": {"EBIT": 60.0}},
    )
    mock_db.query.return_value.filter.return_value.first.return_value = fresh_row
    result = stock_cache._load_cached_fundamentals(MOCK_TICKER)

    assert result["info"]["sector"] == "Technology"
    assert result["balance_sheet"].loc["Total Assets"].iloc[0] == 500.0


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

SPY_STORED_FROM = date(2026, 4, 13)
PORTFOLIO_START = date(2025, 10, 1)


def _weekdays(first, last=None):
    last = last or date.today()
    days = []
    day = first
    while day <= last:
        if day.weekday() < 5:
            days.append(day)
        day += timedelta(days=1)
    return days


def _store(db_session, ticker, first, close=100.0, fetched_at=None):
    fetched_at = fetched_at or datetime.now(UTC) - timedelta(hours=1)
    for day in _weekdays(first):
        db_session.add(MarketData(
            ticker=ticker, date=day, open=close, high=close, low=close, close=close,
            prev_close=close, volume=1, fetched_at=fetched_at,
        ))
    db_session.commit()


def _yahoo_frame(first, close=50.0):
    days = _weekdays(first)
    frame = pd.DataFrame(
        {"Open": close, "High": close, "Low": close, "Close": close, "Volume": 1.0},
        index=pd.DatetimeIndex([pd.Timestamp(d) for d in days]),
    )
    frame["Prev Close"] = frame["Close"].shift(1)
    return frame


def _rows(db_session, ticker):
    db_session.expire_all()
    rows = db_session.scalars(select(MarketData).where(MarketData.ticker == ticker))
    return {row.date: (float(row.close), row.fetched_at) for row in rows}


@pytest.fixture
def cache_db(db_engine):
    with patch.object(stock_cache, "SessionLocal", sessionmaker(bind=db_engine)), \
         patch.object(stock_cache, "_fetch_from_alpha_vantage",
                      side_effect=AssertionError("alpha vantage")):
        yield


@pytest.mark.usefixtures("cache_db")
def test_a_cache_that_starts_late_fetches_the_older_rows_once(db_session):
    _store(db_session, "SPY", SPY_STORED_FROM)
    before = _rows(db_session, "SPY")

    with patch.object(stock_cache, "_fetch_from_yfinance",
                      return_value=_yahoo_frame(date(2025, 9, 1))) as yahoo:
        history = stock_cache.get_cached_price_history(
            "SPY", period="2y", force_live=True, start=PORTFOLIO_START
        )

    assert yahoo.call_count == 1
    after = _rows(db_session, "SPY")
    assert {day: after[day] for day in before} == before
    added = sorted(day for day in after if day not in before)
    assert added[0] == date(2025, 9, 1)
    assert added[-1] < SPY_STORED_FROM
    assert {after[day][0] for day in added} == {50.0}
    assert history.index.min().date() <= date(2025, 10, 3)


@pytest.mark.usefixtures("cache_db")
def test_a_failed_depth_fetch_is_not_retried_inside_the_cooldown(db_session):
    _store(db_session, "SPY", SPY_STORED_FROM)

    with patch.object(stock_cache, "_fetch_from_yfinance",
                      side_effect=RuntimeError("yahoo down")) as yahoo:
        first = stock_cache.get_cached_price_history(
            "SPY", period="2y", force_live=True, start=PORTFOLIO_START
        )
        second = stock_cache.get_cached_price_history(
            "SPY", period="2y", force_live=True, start=PORTFOLIO_START
        )

    assert yahoo.call_count == 1
    assert first.index.min().date() == SPY_STORED_FROM
    assert second.index.min().date() == SPY_STORED_FROM


@pytest.mark.usefixtures("cache_db")
def test_history_that_already_reaches_start_makes_no_call(db_session):
    _store(db_session, "SPY", date(2025, 10, 3))

    with patch.object(stock_cache, "_fetch_from_yfinance") as yahoo, \
         patch.object(stock_cache, "_refresh_price_history") as refresh:
        history = stock_cache.get_cached_price_history(
            "SPY", period="2y", force_live=True, start=PORTFOLIO_START
        )

    yahoo.assert_not_called()
    refresh.assert_not_called()
    assert history.index.min().date() == date(2025, 10, 3)


@pytest.mark.usefixtures("cache_db")
def test_an_etf_with_nothing_older_costs_one_call_per_cooldown(db_session):
    _store(db_session, "SPY", SPY_STORED_FROM)

    with patch.object(stock_cache, "_fetch_from_yfinance", return_value=pd.DataFrame()) as yahoo:
        for _ in range(3):
            history = stock_cache.get_cached_price_history(
                "SPY", period="2y", force_live=True, start=PORTFOLIO_START
            )

    assert yahoo.call_count == 1
    assert history.index.min().date() == SPY_STORED_FROM


@pytest.mark.usefixtures("cache_db")
def test_a_call_without_start_never_reaches_back(db_session):
    _store(db_session, "SPY", SPY_STORED_FROM)

    with patch.object(stock_cache, "_fetch_from_yfinance") as yahoo:
        history = stock_cache.get_cached_price_history("SPY", period="2y", force_live=True)

    yahoo.assert_not_called()
    assert history.index.min().date() == SPY_STORED_FROM


@pytest.mark.usefixtures("cache_db")
def test_the_blended_benchmark_starts_on_the_portfolios_first_day(db_session):
    _store(db_session, "STX40.JO", date(2025, 9, 1), close=90.0)
    _store(db_session, "USDZAR=X", date(2024, 9, 2), close=18.0)
    _store(db_session, "SPY", SPY_STORED_FROM, close=600.0)
    holdings = [
        {"region": REGION_SA, "value": 50.0, "priced_live": True, "ticker": "NPN.JO"},
        {"region": REGION_US, "value": 50.0, "priced_live": True, "ticker": "AAPL"},
    ]

    with patch.object(stock_cache, "_fetch_from_yfinance",
                      return_value=_yahoo_frame(date(2025, 6, 2), close=600.0)) as yahoo:
        series, components = portfolio_service._benchmark_series(
            holdings, PORTFOLIO_START, base_value=1000.0
        )

    assert [call.args[0] for call in yahoo.call_args_list] == ["SPY"]
    assert len(components) == 2
    assert min(series) <= PORTFOLIO_START
    assert series[PORTFOLIO_START] == 1000.0
