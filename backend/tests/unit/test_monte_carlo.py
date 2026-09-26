import math

from app.services.monte_carlo import simulate_goal


def test_zero_years_returns_a_null_result_not_a_crash():
    result = simulate_goal(
        current_value=100_000, target_value=200_000, years=0,
        monthly_contribution=1000, expected_return_pct=8, volatility_pct=15,
    )
    assert result == {
        "probability_pct": None, "months": 0, 
        "path_percentiles": [], 
        "median_final_value": None
        }


def test_zero_target_value_returns_a_null_result_not_a_divide_by_zero():
    result = simulate_goal(
        current_value=100_000, target_value=0, years=5,
        monthly_contribution=1000, expected_return_pct=8, volatility_pct=15,
    )
    assert result["probability_pct"] is None


def test_negative_current_value_is_rejected_rather_than_simulated():
    result = simulate_goal(
        current_value=-100, target_value=100_000, years=5,
        monthly_contribution=1000, expected_return_pct=8, volatility_pct=15,
    )
    assert result["probability_pct"] is None


def test_zero_volatility_gives_a_deterministic_outcome():
    result = simulate_goal(
        current_value=100_000, target_value=110_000, years=1,
        monthly_contribution=0, expected_return_pct=20, volatility_pct=0,
        rng_seed=1,
    )
    assert result["probability_pct"] in (0.0, 100.0)


def test_already_past_the_target_scores_near_certain():
    result = simulate_goal(
        current_value=1_000_000, target_value=100, years=1,
        monthly_contribution=0, expected_return_pct=8, volatility_pct=15,
        rng_seed=1,
    )
    assert result["probability_pct"] > 99


def test_output_is_finite_and_never_negative():
    result = simulate_goal(
        current_value=50_000, target_value=1_000_000, years=30,
        monthly_contribution=500, expected_return_pct=8, volatility_pct=25,
        rng_seed=42,
    )
    assert result["median_final_value"] >= 0
    assert math.isfinite(result["median_final_value"])
    for point in result["path_percentiles"]:
        assert point["p10"] >= 0
        assert math.isfinite(point["p90"])


def test_higher_expected_return_never_lowers_the_probability():
    low = simulate_goal(
        current_value=100_000, target_value=300_000, years=15,
        monthly_contribution=1000, expected_return_pct=4, volatility_pct=12,
        rng_seed=7,
    )
    high = simulate_goal(
        current_value=100_000, target_value=300_000, years=15,
        monthly_contribution=1000, expected_return_pct=12, volatility_pct=12,
        rng_seed=7,
    )
    assert high["probability_pct"] >= low["probability_pct"]


def test_chart_points_are_capped_for_long_horizons():
    result = simulate_goal(
        current_value=100_000, target_value=500_000, years=40,
        monthly_contribution=1000, expected_return_pct=8, volatility_pct=15,
        rng_seed=3,
    )
    assert len(result["path_percentiles"]) <= 26
