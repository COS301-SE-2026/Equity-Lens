from datetime import date, datetime
from unittest.mock import patch

import pytest

from app.models.portfolio import Holdings, Portfolios, PortfolioSnapshot
from app.services import portfolio_service
from app.services.portfolio_service import PortfolioService


@pytest.fixture(autouse=True)
def _clear_snapshot_guard():
    portfolio_service._snapshot_maintenance_done.clear()
    yield
    portfolio_service._snapshot_maintenance_done.clear()


@pytest.fixture
def portfolio_with_a_holding(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()

    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Naspers Limited", ticker="NPN.JO",
        sector="Technology", quantity=10, cost_price=400, total_cost=4000, weight_percentage=100,
    ))
    db_session.commit()
    return portfolio


def test_a_failed_snapshot_write_does_not_break_the_read(
    db_session, test_user
):
    with patch.object(
        portfolio_service.PortfolioRepository,
        "upsert_snapshot",
        side_effect=RuntimeError("row locked"),
    ):
        dashboard = PortfolioService(db_session).get_dashboard(test_user.id)

    assert dashboard["holdings"]
    assert dashboard["summary"]["total_cost"] == 4000.0


@pytest.mark.usefixtures("portfolio_with_a_holding")
def test_the_dashboard_reads_the_transaction_tables_once_each(mocker, db_session, test_user):
    service = PortfolioService(db_session)
    txns = mocker.spy(service.portfolio_repo, "get_instrument_transactions")
    contributions = mocker.spy(service.portfolio_repo, "get_contributions_and_withdrawals")
    classify = mocker.spy(portfolio_service, "classify_instrument_txns")

    service.get_dashboard(test_user.id)

    assert txns.call_count == 1
    assert contributions.call_count == 1
    assert classify.call_count == 1


@pytest.mark.usefixtures("portfolio_with_a_holding")
def test_get_returns_still_fetches_for_itself(db_session, test_user):
    returns = PortfolioService(db_session).get_returns(test_user.id)

    assert returns["invested_capital"] == 4000.0
    assert returns["holdings_count"] == 1


def test_the_snapshot_write_runs_once_a_day_not_once_a_request(
    db_session, test_user
):
    service = PortfolioService(db_session)

    with patch.object(portfolio_service.PortfolioRepository, "upsert_snapshot") as upsert:
        service.get_dashboard(test_user.id)
        portfolio_service.invalidate_priced_holdings()
        service.get_dashboard(test_user.id)

    assert upsert.call_count == 1


def test_the_dashboard_names_both_ends_of_the_reconstruction(
    db_session, test_user, portfolio_with_a_holding
):
    portfolio_with_a_holding.created_at = datetime(2026, 7, 31, 9, 15)
    for day in (date(2026, 2, 4), date(2026, 3, 4)):
        db_session.add(PortfolioSnapshot(
            portfolio_id=portfolio_with_a_holding.id, snapshot_date=day, total_value=4000,
        ))
    db_session.commit()

    dashboard = PortfolioService(db_session).get_dashboard(test_user.id)

    assert dashboard["importedAt"] == "2026-07-31"
    assert dashboard["historyStartsAt"] == "2026-02-04"


@pytest.mark.usefixtures("portfolio_with_a_holding")
def test_history_starts_at_is_null_rather_than_today_when_there_are_no_snapshots(
    db_session, test_user
):
    with patch.object(
        portfolio_service.PortfolioRepository, "get_snapshot_history", return_value=[]
    ):
        dashboard = PortfolioService(db_session).get_dashboard(test_user.id)

    assert dashboard["historyStartsAt"] is None
    assert dashboard["importedAt"] is not None
