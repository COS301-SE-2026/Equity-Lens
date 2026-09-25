"""The per-holding series endpoint's two jobs: serve enough tickers, refuse the wrong ones.

The cap moved from 5 to 15 so the chart can draw four user-built groups alongside five
individually selected holdings. The interesting part of that change is what did NOT move - a
higher cap must not turn a portfolio endpoint into a general price proxy sitting behind a login.
"""
from unittest.mock import patch

import pytest

from app.models.portfolio import Holdings, Portfolios
from app.services import portfolio_service
from app.services.portfolio_service import MAX_SERIES_TICKERS, PortfolioService


@pytest.fixture
def book(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()

    tickers = [f"H{i:02d}.JO" for i in range(MAX_SERIES_TICKERS + 3)]
    for ticker in tickers:
        db_session.add(Holdings(
            portfolio_id=portfolio.id, instrument_name=ticker, ticker=ticker,
            sector="Technology", quantity=1, cost_price=100, total_cost=100,
            weight_percentage=1,
        ))
    db_session.commit()
    return tickers


def test_it_serves_a_full_fifteen(db_session, test_user, book):
    # four groups plus five individual lines is the case the cap was raised for
    with patch.object(portfolio_service, "closes_for_tickers", return_value={}):
        result = PortfolioService(db_session).get_holding_series(test_user.id, book[:15])

    assert len(result["series"]) == 15


def test_it_stops_at_the_cap_rather_than_fetching_the_whole_book(db_session, test_user, book):
    with patch.object(portfolio_service, "closes_for_tickers", return_value={}) as closes:
        PortfolioService(db_session).get_holding_series(test_user.id, book)

    assert len(closes.call_args.args[0]) == MAX_SERIES_TICKERS


def test_a_ticker_the_user_does_not_hold_is_still_refused(db_session, test_user, book):
    # raising the cap must not turn this into a price proxy for anything behind the login
    with patch.object(portfolio_service, "closes_for_tickers", return_value={}) as closes:
        result = PortfolioService(db_session).get_holding_series(
            test_user.id, [book[0], "AAPL", "TSLA"],
        )

    assert [s["ticker"] for s in result["series"]] == [book[0]]
    assert result["not_held"] == ["AAPL", "TSLA"]
    assert closes.call_args.args[0] == [book[0]]
