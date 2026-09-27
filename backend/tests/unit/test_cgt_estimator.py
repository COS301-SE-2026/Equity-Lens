import pytest

from app.services.cgt_estimator import (
    ANNUAL_EXCLUSION_ZAR,
    INCLUSION_RATE_INDIVIDUAL,
    estimate_cgt,
)


def _holding(ticker="NPN.JO", value=200_000.0, total_cost=100_000.0, priced_live=True):
    return {
        "ticker": ticker, "name": ticker, "value": value, "total_cost": total_cost,
        "priced_live": priced_live, "txn_key": None,
    }


def test_the_exclusion_comes_off_before_the_inclusion_rate():
    result = estimate_cgt("zar", [_holding()], [])

    assert result["available"] is True
    assert result["net_unrealised_gain"] == pytest.approx(100_000.0)
    assert result["taxable_capital_gain"] == pytest.approx(20_000.0)
    assert result["assessed_capital_loss"] is None


def test_a_gain_inside_the_exclusion_is_taxed_at_nothing():
    result = estimate_cgt("zar", [_holding(value=140_000.0)], [])

    assert result["net_unrealised_gain"] == pytest.approx(40_000.0)
    assert result["taxable_capital_gain"] == pytest.approx(0.0)


def test_a_loss_is_carried_as_a_loss_rather_than_a_negative_gain():
    result = estimate_cgt("zar", [_holding(value=80_000.0)], [])

    assert result["net_unrealised_gain"] == pytest.approx(-20_000.0)
    assert result["taxable_capital_gain"] is None
    assert result["assessed_capital_loss"] == pytest.approx(20_000.0)


def test_the_assumptions_travel_with_the_number():
    result = estimate_cgt("zar", [_holding()], [])

    assert result["assumptions"]["annual_exclusion"] == ANNUAL_EXCLUSION_ZAR
    assert result["assumptions"]["inclusion_rate"] == INCLUSION_RATE_INDIVIDUAL
    assert result["assumptions"]["cost_basis_method"] == "average_cost"


def test_a_holding_priced_off_the_statement_is_named():
    result = estimate_cgt("zar", [_holding()], [])

    assert result["holdings_from_statement_only"] == ["NPN.JO"]


@pytest.mark.parametrize(
    ("account_type", "holdings", "reason"),
    [
        ("tfsa", [_holding()], "tfsa_exempt"),
        ("usd", [_holding()], "usd_fx_not_supported"),
        (None, [_holding()], "account_type_unknown"),
        ("something_else", [_holding()], "account_type_unknown"),
        ("zar", [], "no_holdings"),
        ("zar", [_holding(priced_live=False)], "unpriced_holdings"),
        ("zar", [_holding(total_cost=0.0)], "cost_basis_incomplete"),
    ],
)
def test_it_declines_rather_than_reporting_a_figure_it_cannot_stand_behind(
    account_type, holdings, reason
):
    result = estimate_cgt(account_type, holdings, [])

    assert result["available"] is False
    assert result["reason"] == reason
    assert result["net_unrealised_gain"] is None
    assert result["taxable_capital_gain"] is None