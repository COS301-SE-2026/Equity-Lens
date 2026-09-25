"""The GET /api/portfolio payload contract, as a test rather than as a docstring.

There is deliberately no response_model on that route. FastAPI filters a response down to the
fields its model declares, so a model that forgot a key would drop it from the payload silently
- on the one endpoint the whole Dashboard reads. The trade is that nothing then checks the
shape at all, which is what this file is for.

Every entry in REQUIRED_KEYS was read off frontend/src/pages/Dashboard/Dashboard.jsx and the
components it hands data to. If a key here stops being produced, the card named in the comment
is the one that breaks.
"""
from datetime import date

import pytest

from app.models.portfolio import Holdings, Portfolios
from app.services.portfolio_service import PortfolioService, invalidate_priced_holdings

# key -> (accepted types, may it be null, where the frontend reads it)
REQUIRED_KEYS = {
    "summary": (dict, False, "Dashboard.jsx:110 summary.daily_change_pct, and DashboardHero"),
    "holdings": (list, False, "Dashboard.jsx:68, then TodayInsights / DashboardHoldingsTable"),
    "sectorAllocation": (list, False, "Dashboard.jsx:125 and :253 -> ConcentrationRisk"),
    "performanceHistory": (list, False, "Dashboard.jsx:70 -> PerformanceVsBenchmark"),
    "historyQuality": (dict, True, "Dashboard.jsx:233 -> HistorySettingsModal"),
    "benchmarkLabel": (str, False, "Dashboard.jsx:91, the chart legend"),
    "benchmarkComposition": (list, False, "Dashboard.jsx:93, the benchmark tooltip"),
    "returns": (dict, False, "Dashboard.jsx:94 returns.history_days, :127 the whole object"),
    "health": (dict, False, "Dashboard.jsx:97 -> PortfolioHealth and DashboardHero"),
    "thresholds": (dict, False, "Dashboard.jsx:84 concentration_low / concentration_high"),
    "contributionsSeries": (list, False, "Dashboard.jsx:90 -> ContributionsChart"),
    "accountType": (str, True, "Dashboard.jsx:133, the tax insight templates"),
    "statementDate": (str, True, "Dashboard.jsx:132, the stale-statement insight"),
    "importedAt": (str, True, "Dashboard.jsx:232, which chart points are reconstructed"),
    "cgt": (dict, True, "Dashboard.jsx:131, the CGT insight template"),
}

# the three the frontend reads out of nested objects rather than off the top level
REQUIRED_NESTED = {
    "thresholds": ("concentration_low", "concentration_high"),
    "health": ("score", "label", "subscores"),
    "summary": ("daily_change_pct",),
}


@pytest.fixture(autouse=True)
def _clear_cache():
    invalidate_priced_holdings()
    yield
    invalidate_priced_holdings()


@pytest.fixture()
def imported_portfolio(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-PAYLOAD", portfolio_name="EasyEquities",
        currency="ZAR", account_type="zar", statement_end_date=date(2026, 6, 25),
    )
    db_session.add(portfolio)
    db_session.commit()

    for ticker, sector, cost_price in (
        ("NPN.JO", "Technology", 500),
        ("SBK.JO", "Financials", 300),
    ):
        db_session.add(Holdings(
            portfolio_id=portfolio.id, instrument_name=ticker, ticker=ticker, sector=sector,
            quantity=10, cost_price=cost_price, total_cost=cost_price * 10,
        ))
    db_session.commit()
    return portfolio


def test_every_key_the_dashboard_reads_is_present(db_session, test_user, imported_portfolio):
    payload = PortfolioService(db_session).get_dashboard(test_user.id)

    missing = [key for key in REQUIRED_KEYS if key not in payload]
    assert not missing, f"the dashboard reads these and the payload no longer carries them: {missing}"


def test_each_key_has_the_type_the_frontend_assumes(db_session, test_user, imported_portfolio):
    payload = PortfolioService(db_session).get_dashboard(test_user.id)

    for key, (expected_type, nullable, consumed_at) in REQUIRED_KEYS.items():
        value = payload[key]
        if value is None:
            assert nullable, f"{key} came back null but {consumed_at} does not guard for it"
            continue
        assert isinstance(value, expected_type), (
            f"{key} is {type(value).__name__}, expected {expected_type.__name__} - {consumed_at}"
        )


def test_the_nested_fields_the_cards_destructure_are_there(db_session, test_user, imported_portfolio):
    payload = PortfolioService(db_session).get_dashboard(test_user.id)

    for parent, children in REQUIRED_NESTED.items():
        for child in children:
            assert child in payload[parent], f"{parent}.{child} is read directly by the dashboard"


def test_a_holding_row_carries_what_the_table_renders(db_session, test_user, imported_portfolio):
    # DashboardHoldingsTable reads value and daily_change_pct per row, and buildSectors reads
    # sector. daily_change_pct is allowed to be null - it usually is, because the live-price
    # fallback is off in production - but the key itself has to exist
    payload = PortfolioService(db_session).get_dashboard(test_user.id)
    row = payload["holdings"][0]

    for field in ("ticker", "value", "sector", "daily_change_pct", "priced_live"):
        assert field in row, f"holdings[].{field} is read by DashboardHoldingsTable"
    assert isinstance(row["value"], (int, float))


def test_thresholds_are_numbers_the_badges_can_compare_against(
    db_session, test_user, imported_portfolio
):
    # these drive the concentration badge colours. a string here renders a badge that is
    # always "low", because "25" > 40 is false in JS
    payload = PortfolioService(db_session).get_dashboard(test_user.id)

    assert isinstance(payload["thresholds"]["concentration_low"], (int, float))
    assert isinstance(payload["thresholds"]["concentration_high"], (int, float))
    assert payload["thresholds"]["concentration_low"] < payload["thresholds"]["concentration_high"]


def test_the_payload_has_not_grown_keys_nobody_reads(db_session, test_user, imported_portfolio):
    # not a failure on its own - historyStartsAt is produced and Dashboard.jsx does not read it -
    # but a payload that keeps growing on the one endpoint that was optimised for speed is worth
    # noticing. update REQUIRED_KEYS or KNOWN_UNREAD when this fires
    known_unread = {"historyStartsAt"}
    payload = PortfolioService(db_session).get_dashboard(test_user.id)

    unexpected = set(payload) - set(REQUIRED_KEYS) - known_unread
    assert not unexpected, f"new keys on the dashboard payload: {sorted(unexpected)}"
