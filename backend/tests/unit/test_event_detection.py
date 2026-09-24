import math
from datetime import date, timedelta

import pytest

from app.services.event_detection import (
    MAX_GAP_DAYS,
    MIN_OBSERVATIONS,
    SEED_OBSERVATIONS,
    band_for,
    log_returns,
    rank_in_period,
    score_series,
)

START = date(2026, 1, 1)


def series_from_returns(returns, start_price=100.0, start=START, step_days=1):
    prices = [(start, start_price)]
    price = start_price
    for i, r in enumerate(returns, start=1):
        price *= math.exp(r)
        prices.append((start + timedelta(days=i * step_days), price))
    return prices


def alternating_seed():
    return [0.01 if i % 2 == 0 else -0.01 for i in range(SEED_OBSERVATIONS)]


def test_the_z_score_matches_the_arithmetic_done_by_hand():
    returns = alternating_seed() + [0.0] * 29 + [0.02]
    assert len(returns) == MIN_OBSERVATIONS

    result = score_series(series_from_returns(returns))

    assert result["available"] is True
    assert result["observations"] == 60
    assert result["seed_variance"] == pytest.approx(0.003 / 29)
    assert len(result["events"]) == 1
    assert result["events"][0]["z_score"] == 4.82
    assert result["events"][0]["date"] == (START + timedelta(days=60)).isoformat()
    assert result["events"][0]["direction"] == "up"
    assert result["events"][0]["return_pct"] == 2.02


def test_the_events_own_return_is_not_in_the_variance_it_is_measured_against():
    quiet = alternating_seed() + [0.0] * 29
    small = score_series(series_from_returns([*quiet, 0.02]))["events"][0]
    large = score_series(series_from_returns([*quiet, 0.04]))["events"][0]

    assert small["sigma"] == large["sigma"]
    assert large["z_score"] == pytest.approx(small["z_score"] * 2, abs=0.01)


def test_the_same_move_is_an_event_in_a_calm_series_and_not_in_a_choppy_one():
    calm = [0.002 if i % 2 == 0 else -0.002 for i in range(59)]
    choppy = [0.02 if i % 2 == 0 else -0.02 for i in range(59)]

    assert len(score_series(series_from_returns([*calm, 0.03]))["events"]) == 1
    assert score_series(series_from_returns([*choppy, 0.03]))["events"] == []


def test_a_return_across_a_long_gap_is_dropped():
    prices = [
        (date(2026, 3, 2), 100.0),
        (date(2026, 3, 3), 101.0),
        (date(2026, 3, 12), 150.0), 
        (date(2026, 3, 13), 151.0),
    ]
    days = [day for day, _ in log_returns(prices)]

    assert days == [date(2026, 3, 3), date(2026, 3, 13)]
    assert MAX_GAP_DAYS == 4


def test_it_refuses_rather_than_guessing_below_sixty_observations():
    result = score_series(series_from_returns([0.01] * 59))

    assert result == {
        "available": False,
        "reason": "insufficient_history",
        "observations": 59,
        "events": [],
    }


def test_a_series_with_no_unusual_day_returns_no_events_but_still_reports_coverage():
    result = score_series(series_from_returns(alternating_seed() + [0.01, -0.01] * 15))

    assert result["available"] is True
    assert result["events"] == []
    assert result["scored_days"] == 60 - SEED_OBSERVATIONS
    first_scored = START + timedelta(days=SEED_OBSERVATIONS + 1)
    assert result["first_scored_date"] == first_scored.isoformat()


def test_the_threshold_is_a_parameter_not_a_constant():
    returns = alternating_seed() + [0.0] * 29 + [0.02]
    series = series_from_returns(returns)

    assert len(score_series(series, k_sigma=3.0)["events"]) == 1
    assert score_series(series, k_sigma=6.0)["events"] == []

@pytest.mark.parametrize(
    ("z", "expected"),
    [
        (2.99, None),
        (3.00, "unusual"),
        (3.99, "unusual"),
        (4.00, "very_unusual"),
        (4.99, "very_unusual"),
        (5.00, "extremely_unusual"),
    ],
)
def test_the_band_changes_exactly_on_each_threshold(z, expected):
    assert band_for(z) == expected
    assert band_for(-z) == expected

def test_the_rank_counts_only_bigger_moves_the_same_way():
    returns = [-0.05, 0.08, -0.03, -0.06, 0.01, -0.04]

    assert rank_in_period(returns, -0.04) == 3
    assert rank_in_period([*returns, -0.04], -0.04) == 3
    assert rank_in_period(returns, 0.08) == 1

def test_each_event_carries_its_sigma_rank_and_period():
    returns = alternating_seed() + [0.0] * 29 + [0.02]

    event = score_series(series_from_returns(returns))["events"][0]
    assert event["daily_sigma_pct"] == 0.41
    assert event["rank_in_period"] == 1
    assert event["period_days"] == 60
