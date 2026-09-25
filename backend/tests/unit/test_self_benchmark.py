"""The holding that is its own benchmark, and what kind of move each event was.

STX40.JO is both the SA region benchmark and a held instrument, so an event on it used to be
regressed against itself. That is not a presentation bug: it produces a real-looking payload
whose every company-specific figure is exactly zero.
"""
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.models.portfolio import Holdings, Portfolios
from app.services import portfolio_service
from app.services.event_study import run as run_event_study
from app.services.instruments import REGION_SA, REGION_US, is_region_benchmark
from app.services.portfolio_service import PortfolioService, classify_move


def _series(days: int = 200) -> list[tuple[date, float]]:
    start = date(2026, 1, 1)
    # a deterministic wobble - the shape does not matter, only that it is not a straight line
    return [(start + timedelta(days=i), 100 + (i % 7) - (i % 3) * 0.5) for i in range(days)]


def test_regressing_a_series_on_itself_produces_a_result_that_contains_nothing():
    """Characterisation test for the bug. This documents what the degenerate case does.

    cov(x, x) / var(x) is 1 exactly, so alpha is mean(x) - 1*mean(x) = 0, every residual is 0,
    sigma is 0 and the confidence band is 1.96 * 0 * sqrt(k). Nobody should reintroduce this.
    """
    series = _series()
    study = run_event_study(series, series, series[150][0])

    assert study["available"] is True
    assert study["beta"] == pytest.approx(1.0)
    assert study["alpha"] == pytest.approx(0.0, abs=1e-12)
    assert study["residual_sigma"] == pytest.approx(0.0, abs=1e-12)
    assert all(row["abnormal_return_pct"] == 0.0 for row in study["abnormal_returns"])
    assert all(row["car_lower_pct"] == 0.0 for row in study["abnormal_returns"])
    assert not any(row["significant"] for row in study["abnormal_returns"])


def test_is_region_benchmark_only_matches_its_own_region():
    assert is_region_benchmark("STX40.JO", REGION_SA) is True
    assert is_region_benchmark("stx40.jo", REGION_SA) is True
    # the same ticker measured against a different region's index is a normal study
    assert is_region_benchmark("STX40.JO", REGION_US) is False
    assert is_region_benchmark("NPN.JO", REGION_SA) is False
    assert is_region_benchmark(None, REGION_SA) is False


@pytest.fixture
def holds_the_benchmark(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Satrix 40 Exchange Traded Fund",
        ticker="STX40.JO", sector="Diversified", quantity=100, cost_price=70,
        total_cost=7000, weight_percentage=100,
    ))
    db_session.commit()
    return portfolio


@pytest.mark.usefixtures("holds_the_benchmark")
def test_the_study_refuses_before_it_fetches_a_single_price(db_session, test_user):
    with patch.object(portfolio_service, "single_ticker_closes") as closes, \
         patch.object(portfolio_service, "benchmark_levels") as benchmark:
        detail = PortfolioService(db_session).get_event_detail(
            test_user.id, "STX40.JO", date(2026, 1, 30),
        )

    assert detail["available"] is False
    assert detail["reason"] == "benchmark_is_self"
    assert detail["benchmark_label"] == "Satrix 40 (JSE Top 40 proxy)"
    # by construction the holding IS the market, so there is no other half to attribute to
    assert detail["move_type"] == "market"
    # the benchmark series fetch is the expensive half of this endpoint, and neither ran
    closes.assert_not_called()
    benchmark.assert_not_called()


@pytest.mark.usefixtures("holds_the_benchmark")
def test_the_refusal_still_carries_its_articles(db_session, test_user):
    # a market-wide fall is exactly the kind of day there is news about
    with patch.object(PortfolioService, "_possible_explanations", return_value=[{"x": 1}]):
        detail = PortfolioService(db_session).get_event_detail(
            test_user.id, "STX40.JO", date(2026, 1, 30),
        )

    assert detail["possible_explanations"] == [{"x": 1}]


class TestClassifyMove:
    # classify_move(market part, company part), and the move itself is R = m + c

    @pytest.mark.parametrize(
        ("market", "company", "expected"),
        [
            # R = -10: 6.5 / 10 = 0.65, exactly on the company line
            (-3.5, -6.5, "company"),
            # R = -10: 3.5 / 10 = 0.35, exactly on the market line
            (-6.5, -3.5, "market"),
            # R = -10: 5 / 10 = 0.5, between the two
            (-5.0, -5.0, "mixed"),
            # R = -10.8 while the market rose 0.4: the stock went the other way
            (0.4, -11.2, "against_market"),
            # R = -2 with the market part -3: the market explains more than all of the fall
            (-3.0, 1.0, "market"),
            # the client's MTN day: R = -10.8, 10.61 / 10.8 = 0.98
            (-0.19, -10.61, "company"),
        ],
    )
    def test_the_split_decides_the_label(self, market, company, expected):
        assert classify_move(market, company) == expected

    def test_it_refuses_rather_than_dividing_by_zero(self):
        # R = 0 has no share to take, and no decomposition has nothing to classify
        assert classify_move(-1.0, 1.0) == "unknown"
        assert classify_move(None, None) == "unknown"
