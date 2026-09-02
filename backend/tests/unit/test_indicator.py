from unittest.mock import MagicMock, patch
from app.routers.indicators import get_indicators

def _mock_user(user_id=1):
    user = MagicMock()
    user.id = user_id
    return user

def _mock_db(portfolios=None, holdings=None):
    db = MagicMock()

    def query_side_effect(model):
        query_mock = MagicMock()
        model_name = getattr(model, "__name__", "")
        if model_name == "Portfolios":
            query_mock.filter.return_value.all.return_value = portfolios or []
        elif model_name == "Holdings":
            query_mock.filter.return_value.all.return_value = holdings or []
        return query_mock

    db.query.side_effect = query_side_effect
    return db

def _mock_holding(ticker, instrument_name=None, portfolio_id=1):
    holding = MagicMock()
    holding.ticker = ticker
    holding.instrument_name = instrument_name
    holding.portfolio_id = portfolio_id
    return holding

def _mock_portfolio(portfolio_id=1):
    portfolio = MagicMock()
    portfolio.id = portfolio_id
    return portfolio

def test_returns_empty_list_when_user_has_no_portfolios():
    db = _mock_db(portfolios=[])

    with patch("app.routers.indicators.get_market_returns", return_value=None):
        result = get_indicators(current_user=_mock_user(), db=db)

    assert result == []

def test_returns_empty_list_when_portfolios_have_no_holdings():
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=[])

    with patch("app.routers.indicators.get_market_returns", return_value=None):
        result = get_indicators(current_user=_mock_user(), db=db)

    assert result == []

@patch("app.routers.indicators.time.sleep")
@patch("app.routers.indicators.get_market_returns", return_value=None)
@patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r)
@patch("app.routers.indicators.get_cached_price_histories", return_value={}) 
@patch("app.routers.indicators.build_live_indicator_row")
def test_serializes_every_built_row_and_returns_them_in_order(mock_build_row, _mock_histories, _mock_serialize, _mock_returns, _mock_sleep):
    holdings = [_mock_holding(ticker="NPN"), _mock_holding(ticker="ABG")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {"NPN": {"ticker": "NPN", "pe_ratio": 12.0, "live_fetch": False}, "ABG": {"ticker": "ABG", "pe_ratio": 8.5, "live_fetch": False}}
    mock_build_row.side_effect = lambda ticker, *args, **kwargs: built_rows[ticker]

    result = get_indicators(current_user=_mock_user(), db=db)

    assert result == [built_rows["NPN"], built_rows["ABG"]]

@patch("app.routers.indicators.time.sleep")
@patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r)
@patch("app.routers.indicators.get_cached_price_histories", return_value={})
@patch("app.routers.indicators.get_market_returns", return_value=None)
@patch("app.routers.indicators.build_live_indicator_row")
def test_sleep_is_skipped_when_no_ticker_made_a_live_fetch(
    mock_build_row, _mock_returns, _mock_cached_histories, _mock_serialize, mock_sleep
):
    holdings = [_mock_holding(ticker="NPN"), _mock_holding(ticker="ABG")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {
        "NPN": {"ticker": "NPN", "pe_ratio": 12.0, "live_fetch": False},
        "ABG": {"ticker": "ABG", "pe_ratio": 8.5, "live_fetch": False},
    }
    mock_build_row.side_effect = lambda ticker, *args, **kwargs: built_rows[ticker]

    get_indicators(current_user=_mock_user(), db=db)

    mock_sleep.assert_not_called()

@patch("app.routers.indicators.time.sleep")
@patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r)
@patch("app.routers.indicators.get_cached_price_histories", return_value={})
@patch("app.routers.indicators.get_market_returns", return_value=None)
@patch("app.routers.indicators.build_live_indicator_row")
def test_sleep_fires_only_after_a_ticker_that_made_a_live_fetch(
    mock_build_row, _mock_returns, _mock_cached_histories, _mock_serialize, mock_sleep
):
    holdings = [_mock_holding(ticker="NPN"), _mock_holding(ticker="ABG"), _mock_holding(ticker="MTN")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {
        "NPN": {"ticker": "NPN", "pe_ratio": 12.0, "live_fetch": True},
        "ABG": {"ticker": "ABG", "pe_ratio": 8.5, "live_fetch": False},
        "MTN": {"ticker": "MTN", "pe_ratio": 9.0, "live_fetch": False},
    }
    mock_build_row.side_effect = lambda ticker, *args, **kwargs: built_rows[ticker]

    get_indicators(current_user=_mock_user(), db=db)

    assert mock_sleep.call_count == 1


@patch("app.routers.indicators.time.sleep")
@patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r)
@patch("app.routers.indicators.get_cached_price_histories", return_value={})
@patch("app.routers.indicators.get_market_returns", return_value=None)
@patch("app.routers.indicators.build_live_indicator_row")
def test_no_sleep_after_the_last_ticker_even_if_it_was_a_live_fetch(
    mock_build_row, _mock_returns, _mock_cached_histories, _mock_serialize, mock_sleep
):
    holdings = [_mock_holding(ticker="NPN")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {"NPN": {"ticker": "NPN", "pe_ratio": 12.0, "live_fetch": True}}
    mock_build_row.side_effect = lambda ticker, *args, **kwargs: built_rows[ticker]

    get_indicators(current_user=_mock_user(), db=db)

    mock_sleep.assert_not_called()


@patch("app.routers.indicators.time.sleep")
@patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r)
@patch("app.routers.indicators.get_cached_price_histories", return_value={})
@patch("app.routers.indicators.get_market_returns", return_value=None)
@patch("app.routers.indicators.build_live_indicator_row")
def test_price_histories_batched_once_for_all_tickers(
    mock_build_row, _mock_returns, mock_cached_histories, _mock_serialize, _mock_sleep
):
    holdings = [_mock_holding(ticker="NPN"), _mock_holding(ticker="ABG")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {
        "NPN": {"ticker": "NPN", "live_fetch": False},
        "ABG": {"ticker": "ABG", "live_fetch": False},
    }
    mock_build_row.side_effect = lambda ticker, *args, **kwargs: built_rows[ticker]

    get_indicators(current_user=_mock_user(), db=db)

    mock_cached_histories.assert_called_once_with(["NPN", "ABG"], period="1y")