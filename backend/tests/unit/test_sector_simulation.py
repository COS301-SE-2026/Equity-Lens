import pytest

from app.services.health_score import PRESETS, preset_config
from app.services.portfolio_service import (
    SECTOR_INVESTMENT_PCT_OF_PORTFOLIO,
    _simulate_sector_investment,
    _simulate_sector_rebalance,
)


def _holding(ticker, sector, value):
    return {
        "ticker": ticker, "name": ticker, "value": value, "sector": sector,
        "region": "South Africa", "kind": "stock", "priced_live": True, "current_price": 100.0,
    }

BOOK = [
    _holding("NPN.JO", "Technology", 103773.0),
    _holding("SBK.JO", "Financials", 25839.0),
    _holding("STX40.JO", "SA Equity", 16053.0),
    _holding("AGL.JO", "Materials", 13153.0),
    _holding("MTN.JO", "Telecommunications", 8678.0),
]
TOTAL = 167496.0
INJECTION = 8374.80


def test_the_injection_is_five_percent_of_the_book():
    assert SECTOR_INVESTMENT_PCT_OF_PORTFOLIO == 0.05
    result = _simulate_sector_investment(BOOK, "Financials", preset_config("equitylens"))
    assert result["illustrative_amount"] == pytest.approx(INJECTION)


@pytest.mark.parametrize(
    ("preset", "after"),
    [("equitylens", 4.2), ("core_satellite", 4.4), ("institutional", 3.2)],
)
def test_topping_up_the_most_concentrated_sector_costs_score(preset, after):
    config = preset_config(preset)
    result = _simulate_sector_investment(BOOK, "Technology", config)

    assert result["health_score_after"] == pytest.approx(after)
    assert result["health_score_after"] < result["health_score_before"]


def test_the_largest_sector_loses_score_under_every_preset():
    for key in PRESETS:
        result = _simulate_sector_investment(BOOK, "Technology", preset_config(key))
        assert result["health_score_after"] < result["health_score_before"], key


def test_the_top_up_scales_what_is_held_rather_than_inventing_a_position():
    result = _simulate_sector_investment(BOOK, "Technology", preset_config("equitylens"))

    assert result["current_weight_pct"] == pytest.approx(61.96, abs=0.01)
    assert result["projected_weight_pct"] == pytest.approx(63.8, abs=0.05)


def test_two_sectors_that_round_to_the_same_composite_can_still_differ_underneath():
    config = preset_config("equitylens")
    sa_equity = _simulate_sector_investment(BOOK, "SA Equity", config)
    materials = _simulate_sector_investment(BOOK, "Materials", config)

    assert sa_equity["health_score_after"] == materials["health_score_after"]

    by_key = {d["key"]: d["after"] for d in sa_equity["subscore_deltas"]}
    other = {d["key"]: d["after"] for d in materials["subscore_deltas"]}
    assert by_key.keys() == other.keys()
    assert by_key["portfolioBreadth"] != other["portfolioBreadth"]


def test_every_subscore_is_reported_with_the_weight_it_carries():
    result = _simulate_sector_investment(BOOK, "Financials", preset_config("equitylens"))
    deltas = result["subscore_deltas"]

    assert len(deltas) == 3
    assert sum(d["weight"] for d in deltas) == pytest.approx(1.0)
    for delta in deltas:
        assert set(delta) == {"key", "label", "before", "after", "weight"}


def test_the_explanation_does_not_claim_to_spread_risk_into_a_concentrated_sector():
    config = preset_config("equitylens")
    result = _simulate_sector_investment(BOOK, "Technology", config)

    assert "spreads sector risk" not in result["explanation"]
    assert f"{config.concentration_high:.0f}%" in result["explanation"]
    assert "62.0%" in result["explanation"]


def test_the_explanation_still_says_it_spreads_risk_for_a_thin_sector():
    result = _simulate_sector_investment(BOOK, "Telecommunications", preset_config("equitylens"))

    assert "spreads sector risk" in result["explanation"]
    assert result["is_smallest_sector"] is True


def test_a_sector_between_the_two_levels_is_described_as_already_above_the_watch_level():
    book = [_holding("A.JO", "Financials", 30.0), _holding("B.JO", "Technology", 70.0)]
    result = _simulate_sector_investment(book, "Financials", preset_config("equitylens"))

    assert "watch level" in result["explanation"]
    assert "spreads sector risk" not in result["explanation"]


def test_an_unheld_sector_is_refused_rather_than_divided_by_zero():
    assert _simulate_sector_investment(BOOK, "Healthcare", preset_config("equitylens")) == {
        "available": False, "reason": "unknown_sector",
    }


def test_the_rebalance_tops_up_the_thin_sector_instead_of_inventing_a_position():
    result = _simulate_sector_rebalance(BOOK, preset_config("equitylens"))

    assert result["available"] is True
    assert result["from_sector"] == "Technology"
    assert result["to_sector"] == "Telecommunications"
    assert result["health_score_after"] > result["health_score_before"]
    assert len(result["subscore_deltas"]) == 3


def test_the_rebalance_does_not_change_the_number_of_positions():
    result = _simulate_sector_rebalance(BOOK, preset_config("equitylens"))
    breadth = next(d for d in result["subscore_deltas"] if "readth" in d["label"])

    assert result["value_shifted"] > 0
    assert breadth["after"] > breadth["before"]
