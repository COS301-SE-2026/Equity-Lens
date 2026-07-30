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

def test_serializes_every_built_row_and_returns_them_in_order():
    holdings = [_mock_holding(ticker="NPN"), _mock_holding(ticker="ABG")]
    db = _mock_db(portfolios=[_mock_portfolio()], holdings=holdings)

    built_rows = {"NPN": {"ticker": "NPN", "pe_ratio": 12.0}, "ABG": {"ticker": "ABG", "pe_ratio": 8.5}}

    with patch("app.routers.indicators.get_market_returns", return_value=None), \
         patch("app.routers.indicators.build_live_indicator_row", side_effect=lambda t, n, m: built_rows[t]), \
         patch("app.routers.indicators.serialize_indicator_row", side_effect=lambda r: r), \
         patch("app.routers.indicators.time.sleep"):
        result = get_indicators(current_user=_mock_user(), db=db)

    assert result == [built_rows["NPN"], built_rows["ABG"]]