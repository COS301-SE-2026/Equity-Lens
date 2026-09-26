import json

import numpy as np
import pandas as pd
import pytest

from app.services import portfolio_insights as insights

WEEKS = pd.date_range("2025-01-03", periods=52, freq="W-FRI")


@pytest.fixture
def factors():
    rng = np.random.default_rng(7)
    return pd.DataFrame(
        {
            "jse": rng.normal(0.002, 0.02, len(WEEKS)),
            "rand": rng.normal(0.0, 0.015, len(WEEKS)),
            "gold": rng.normal(0.001, 0.02, len(WEEKS)),
            "oil": rng.normal(0.0, 0.03, len(WEEKS)),
        },
        index=WEEKS,
    )


def _portfolio(factors, noise=0.0):
    rng = np.random.default_rng(11)
    return (
        0.001
        + 0.8 * factors["jse"]
        + 0.4 * factors["rand"]
        + rng.normal(0.0, noise, len(factors))
    )


def test_weekly_log_returns():
    days = pd.bdate_range("2025-01-06", periods=10)
    close = pd.Series([100, 102, 104, 106, 110, 110, 110, 110, 110, 121], index=days)

    weekly = insights.weekly_log_returns(close)

    assert weekly.iloc[0] == pytest.approx(np.log(110 / 100))
    assert weekly.iloc[1] == pytest.approx(np.log(121 / 110))


def test_recovers_known_sensitivities(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.002), factors)
    drivers = {d["key"]: d for d in result["drivers"]}

    assert result["available"]
    assert drivers["jse"]["beta"] == pytest.approx(0.8, abs=0.05)
    assert drivers["rand"]["beta"] == pytest.approx(0.4, abs=0.05)
    assert drivers["jse"]["clear"]
    assert drivers["rand"]["clear"]
    assert not drivers["gold"]["clear"]
    assert not drivers["oil"]["clear"]

def test_contributions_add_to_total(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.01), factors)

    parts = sum(d["contribution_pct"] for d in result["drivers"]) + result["own_picks_pct"]
    assert parts == pytest.approx(result["total_return_pct"], abs=0.05)


def test_sensitivity_quoted(factors):
    result = insights.explain_moves(_portfolio(factors), factors)
    jse = next(d for d in result["drivers"] if d["key"] == "jse")

    assert jse["sensitivity_pct"] == pytest.approx((1.1 ** jse["beta"] - 1) * 100, abs=0.05)


def test_missing_factor(factors):
    result = insights.explain_moves(_portfolio(factors), factors[["jse", "rand"]])

    assert [d["key"] for d in result["drivers"]] == ["jse", "rand"]


def testlittle_history(factors):
    short = factors.iloc[: insights.MIN_WEEKS - 1]

    result = insights.explain_moves(_portfolio(short), short)

    assert result == {
        "available": False,
        "reason": f"Needs {insights.MIN_WEEKS} weeks of shared price history, "
        f"found {insights.MIN_WEEKS - 1}.",
    }


def test__json_serialisable(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.01), factors)

    json.dumps(result)

def test_weak_links(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.002), factors)
    reactions = {d["key"]: d["reaction"] for d in result["drivers"]}

    assert reactions["jse"] == "clear"
    assert reactions["gold"] == "little"
    assert reactions["oil"] == "little"


def test_noisy_links(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.08), factors)

    assert any(d["reaction"] == "unclear" for d in result["drivers"])


def test_sensitivity(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.002), factors, 100_000)
    jse = next(d for d in result["drivers"] if d["key"] == "jse")
    crash = next(s for s in result["scenarios"] if s["name"] == "The JSE Top 40 falls 20%")

    assert crash["effect_pct"] == pytest.approx((0.8 ** jse["beta"] - 1) * 100, abs=0.05)
    assert crash["effect_value"] == pytest.approx(1_000 * crash["effect_pct"], abs=10)
    assert crash["low_pct"] < crash["effect_pct"] < crash["high_pct"]


def test_scenarios_missing_factor(factors):
    result = insights.explain_moves(_portfolio(factors), factors[["jse", "rand"]])
    names = [s["name"] for s in result["scenarios"]]

    assert "The oil price jumps 30%" not in names
    assert "A global sell-off like March 2020" not in names
    assert "The JSE Top 40 falls 20%" in names


def test_scenarios_no_rand(factors):
    result = insights.explain_moves(_portfolio(factors), factors)

    assert all(s["effect_value"] is None for s in result["scenarios"])


def test_return(factors):
    result = insights.explain_moves(_portfolio(factors, noise=0.02), factors)

    assert result["own_picks_clear"] is False
