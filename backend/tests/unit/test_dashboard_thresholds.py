import pytest

from app.models.portfolio import Holdings, Portfolios
from app.repositories.user_preference_repository import UserPreferenceRepository
from app.schemas.portfolio import ConcentrationResponse
from app.services.instruments import KIND_STOCK, REGION_SA
from app.services.portfolio_service import (
    PortfolioService,
    _build_concentration_analysis,
    invalidate_priced_holdings,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    invalidate_priced_holdings()
    yield
    invalidate_priced_holdings()


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


def test_the_dashboard_carries_the_thresholds_it_scored_with(
    db_session, test_user, portfolio_with_a_holding
):
    dashboard = PortfolioService(db_session).get_dashboard(test_user.id)

    assert dashboard["thresholds"]["concentration_low"] == 25
    assert dashboard["thresholds"]["concentration_high"] == 45


@pytest.fixture
def three_sector_portfolio(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-2", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()

    for ticker, sector, cost_price in (
        ("NPN.JO", "Technology", 500),
        ("SBK.JO", "Financials", 300),
        ("APN.JO", "Healthcare", 200),
    ):
        db_session.add(Holdings(
            portfolio_id=portfolio.id, instrument_name=ticker, ticker=ticker, sector=sector,
            quantity=10, cost_price=cost_price, total_cost=cost_price * 10,
        ))
    db_session.commit()
    return portfolio


def test_a_50_percent_sector_is_rebalanceable_under_the_default_ceiling(
    db_session, test_user, three_sector_portfolio
):
    result = PortfolioService(db_session).simulate_sector_rebalance(test_user.id)

    assert result["available"] is True
    assert result["from_sector"] == "Technology"
    assert result["thresholds"]["concentration_high"] == 45


def test_the_same_portfolio_is_not_rebalanceable_once_the_ceiling_moves_to_60(
    db_session, test_user, three_sector_portfolio
):
    UserPreferenceRepository(db_session).upsert(test_user.id, health_preset_key="concentrated")
    db_session.commit()
    invalidate_priced_holdings()

    result = PortfolioService(db_session).simulate_sector_rebalance(test_user.id)

    assert result["available"] is False
    assert result["reason"] == "no_sector_overconcentrated"
    assert result["thresholds"]["concentration_high"] == 60


def test_concentration_analysis_flags_against_the_users_ceiling(
    db_session, test_user, portfolio_with_a_holding
):
    service = PortfolioService(db_session)
    assert service.get_concentration_analysis(test_user.id)["thresholds"] == {
        "concentration_low": 25,
        "concentration_high": 45,
    }

    UserPreferenceRepository(db_session).upsert(test_user.id, health_preset_key="concentrated")
    db_session.commit()
    invalidate_priced_holdings()

    analysis = service.get_concentration_analysis(test_user.id)
    assert analysis["thresholds"]["concentration_high"] == 60
    assert analysis["flagged"][0]["target_allocation_pct"] == 35


def test_a_flagged_holding_with_no_usable_price_comes_back_with_a_null_share_count():
    unpriced = [{
        "ticker": "NPN.JO", "name": "Naspers Limited", "sector": "Technology",
        "kind": KIND_STOCK, "region": REGION_SA, "priced_live": False,
        "value": 4000.0, "current_price": 0.0,
    }]

    validated = ConcentrationResponse.model_validate(_build_concentration_analysis(unpriced))

    flagged = validated.flagged[0]
    assert flagged.shares_to_sell is None
    assert flagged.value_to_reduce == 4000.0


def test_the_thresholds_follow_the_users_chosen_preset(
    db_session, test_user, portfolio_with_a_holding
):
    UserPreferenceRepository(db_session).upsert(test_user.id, health_preset_key="concentrated")
    db_session.commit()
    invalidate_priced_holdings()

    dashboard = PortfolioService(db_session).get_dashboard(test_user.id)

    assert dashboard["thresholds"]["concentration_low"] == 35
    assert dashboard["thresholds"]["concentration_high"] == 60
