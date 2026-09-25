from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.models.portfolio import Portfolios
from app.services.ai_service import _indicator_reading, _resolve_portfolio, run_tool


def _portfolio(db_session, user, name):
    portfolio = Portfolios(user_id=user.id, portfolio_name=name, account_number="ACC-1")
    db_session.add(portfolio)
    db_session.commit()
    return portfolio


def test_resolve_portfolio_branches(db_session, test_user):
    assert _resolve_portfolio(db_session, test_user.id)[0] is None
    first = _portfolio(db_session, test_user, "Growth")

    assert _resolve_portfolio(db_session, test_user.id)[0].id == first.id
    second = _portfolio(db_session, test_user, "Income")

    assert _resolve_portfolio(db_session, test_user.id, "income")[0].id == second.id
    assert _resolve_portfolio(db_session, test_user.id, "portfolio 1")[0].id == first.id
    assert _resolve_portfolio(db_session, test_user.id, portfolio_id=second.id)[0].id == second.id

    portfolio, problem = _resolve_portfolio(db_session, test_user.id, "missing")
    assert portfolio is None
    assert "No portfolio matched" in problem

    portfolio, problem = _resolve_portfolio(db_session, test_user.id)
    assert portfolio is None
    assert "more than one portfolio" in problem


@pytest.mark.parametrize(
    ("section", "expected"),
    [
        ("summary", "Number of holdings: 3"),
        ("fees", "Total fees and expenses: R10.00"),
        ("trading", "Total trading activity: R10.00"),
        ("cash_flow", "No contributions and withdrawals recorded"),
        ("dividends", "Total net dividends: R8.00"),
        ("nonsense", "Unknown section"),
    ],
)
def test_statement_detail(db_session, test_user, section, expected):
    _portfolio(db_session, test_user, "Growth")
    rows = [{"name": "Broker fee", "value": 10.0}]
    summary = {
        "PortfolioValue": 100.0,
        "TotalHoldings": 3,
        "TotalPurchasesAndSales": 1.0,
        "TotalContributionsAndWithdrawals": 2.0,
        "TotalDividendsAndWithholdingTax": 3.0,
        "TotalTransactionExpenses": 4.0,
    }
    dividends = [
        {"name": "NPN", "gross_dividend": 10.0, "withholding_tax": 2.0, "net_dividend": 8.0}
    ]

    with (
        patch("app.services.ai_service.get_summary_import_PDF", return_value=summary),
        patch("app.services.ai_service.get_expenses_import_PDF", return_value=rows),
        patch("app.services.ai_service.get_trading_activity_import_PDF", return_value=rows),
        patch("app.services.ai_service.get_cash_flow_import_PDF", return_value=[]),
        patch("app.services.ai_service.get_dividend_income_import_PDF", return_value=dividends),
    ):
        output = run_tool("get_statement_detail", {"section": section}, db_session, test_user.id)

    assert expected in output


def test_statement_failures(db_session, test_user):
    assert "No portfolio" in run_tool(
        "get_statement_detail", {"section": "fees"}, db_session, test_user.id
    )

    _portfolio(db_session, test_user, "Growth")
    with patch("app.services.ai_service.get_dividend_income_import_PDF", return_value=[]):
        assert "No dividends" in run_tool(
            "get_statement_detail", {"section": "dividends"}, db_session, test_user.id
        )
    with patch(
        "app.services.ai_service.get_expenses_import_PDF", side_effect=RuntimeError("db down")
    ):
        assert "could not be read" in run_tool(
            "get_statement_detail", {"section": "fees"}, db_session, test_user.id
        )


@patch("app.services.ai_service.search_stocks")
def test_find_ticker(mock_search):
    assert "No company name" in run_tool("find_ticker", {}, None, None)
    mock_search.return_value = SimpleNamespace(
        results=[
            SimpleNamespace(symbol="JBL.JO", name="Jubilee Metals"),
            SimpleNamespace(symbol="JLP.L", name="Jubilee Metals"),
        ]
    )
    output = run_tool("find_ticker", {"company": "Jubilee"}, None, None)
    assert "JBL.JO - Jubilee Metals [JSE]" in output
    assert "JLP.L - Jubilee Metals [non-JSE]" in output

    mock_search.return_value = SimpleNamespace(results=[])
    assert "No listed company matched" in run_tool("find_ticker", {"company": "Nope"}, None, None)

    mock_search.side_effect = RuntimeError("yfinance down")
    assert "lookup failed" in run_tool("find_ticker", {"company": "Jubilee"}, None, None)


def test_goal_checks(db_session, test_user):
    assert "how many years" in run_tool("get_goal_projection", {}, db_session, test_user.id)
    assert "too long" in run_tool("get_goal_projection", {"years": 100}, db_session, test_user.id)
    assert "No portfolio value" in run_tool(
        "get_goal_projection", {"years": 10}, db_session, test_user.id
    )
    assert "don't make a projection possible" in run_tool(
        "get_goal_projection", {"years": 10, "current_value": -1}, db_session, test_user.id
    )


@patch("app.services.ai_service._price_holdings", return_value=[{"value": 50000.0}])
def test_goal_projection(_mock_price, db_session, test_user):
    portfolio = _portfolio(db_session, test_user, "Growth")
    output = run_tool(
        "get_goal_projection", {"years": 10, "target_value": 100000}, db_session, test_user.id
    )

    assert "R50,000.00 (the current value of all their portfolios combined)" in output
    assert "Probability of reaching R100,000.00" in output
    assert "were assumed" in output

    output = run_tool("get_goal_projection", {"years": 10}, db_session, test_user.id, portfolio.id)
    assert "the portfolio this chat is about" in output

    output = run_tool(
        "get_goal_projection",
        {"years": 5, "current_value": 1000, "expected_return_pct": 7, "volatility_pct": 10},
        db_session,
        test_user.id,
    )
    assert "the amount given" in output
    assert "were assumed" not in output


@patch("app.services.ai_service.get_indicators_tool", return_value="indicators")
@patch("app.services.ai_service.get_market_news_tool", return_value="news")
@patch("app.services.ai_service.get_stock_data_tool", return_value="stock")
def test_run_tool_dispatch(_stock, _news, _indicators):
    assert run_tool("get_stock_data", {"ticker": "NPN.JO"}, None, None) == "stock"
    assert run_tool("get_market_news", {}, None, None) == "news"
    assert run_tool("get_indicators", {"ticker": "NPN.JO"}, None, None) == "indicators"
    assert run_tool("made_up", {}, None, None) == "Unknown tool: made_up"


@pytest.mark.parametrize(
    ("key", "value", "expected"),
    [
        ("capm", 20, "above what the market"),
        ("pe_ratio", 10, "below market average"),
        ("altman_z", 1.0, "distress zone"),
        ("beta", 2.0, "highly volatile"),
        ("rsi", 80, "overbought"),
        ("sharpe", -1, "below the risk-free rate"),
        ("unknown", 1, ""),
    ],
)
def test_indicator_reading(key, value, expected):
    assert expected in _indicator_reading(key, value)
