from types import SimpleNamespace

import pytest

from app.services import portfolio_service


def _holding(**overrides):
    defaults = {
        "ticker": "MTN.JO", "instrument_name": "MTN Group", "sector": "Communication Services",
        "quantity": 10, "total_cost": 4000.0, "cost_price": 400.0, "weight_percentage": 100.0,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)



def test_build_summary_excludes_unpriced_holdings_from_gain_denominator():
    priced_holdings = [
        {"value": 5000.0, "total_cost": 4000.0, "daily_change_pct": 25.0},
        {"value": 1000.0, "total_cost": 1000.0, "daily_change_pct": 0.0},  # fell back to cost
    ]
    summary = portfolio_service._build_summary(priced_holdings)

    assert summary["total_value"] == 6000.0
    assert summary["total_cost"] == 5000.0
    assert summary["total_gain_loss"] == 1000.0
    assert summary["daily_change_pct"] == pytest.approx(round((5000 * 25.0 + 1000 * 0.0) / 6000, 2))
    assert summary["daily_change_value"] == pytest.approx(5000 * 25.0 / 100)

def _fails_to_price(_ticker, _db=None):
    raise RuntimeError("Too Many Requests. Rate limited. Try after a while.")


def test_daily_change_is_none_not_zero_when_live_pricing_fails(monkeypatch):
    monkeypatch.setattr(portfolio_service, "get_current_price", _fails_to_price)

    priced = portfolio_service._price_holding(_holding())

    assert priced["priced_live"] is False
    assert priced["daily_change_pct"] is None, "a rate-limited holding must not report 0.00%"


def test_build_summary_ignores_unpriced_holdings_on_both_sides_of_the_average():
    priced_holdings = [
        {"value": 5000.0, "total_cost": 4000.0, "daily_change_pct": 10.0},
        {"value": 5000.0, "total_cost": 5000.0, "daily_change_pct": None}, 
    ]
    summary = portfolio_service._build_summary(priced_holdings)
    assert summary["daily_change_pct"] == pytest.approx(10.0)
    assert summary["daily_change_value"] == pytest.approx(500.0)
    assert summary["total_value"] == 10000.0


def test_build_summary_reports_none_when_nothing_could_be_priced():
    priced_holdings = [
        {"value": 5000.0, "total_cost": 5000.0, "daily_change_pct": None},
        {"value": 1000.0, "total_cost": 1000.0, "daily_change_pct": None},
    ]
    summary = portfolio_service._build_summary(priced_holdings)

    assert summary["daily_change_pct"] is None
    assert summary["daily_change_value"] is None
    assert summary["total_value"] == 6000.0


def test_build_market_context_survives_unpriced_holdings():
    priced_holdings = [
        {"value": 6000.0, "sector": "Technology", "ticker": "NPN.JO", "daily_change_pct": 5.0},
        {"value": 4000.0, "sector": "Technology", "ticker": "SBK.JO", "daily_change_pct": None},
    ]
    result = portfolio_service._build_market_context(priced_holdings)

    tech = next(s for s in result["sectors"] if s["sector"] == "Technology")
    assert tech["weight_pct"] == pytest.approx(100.0)  
    assert tech["daily_change_pct"] == pytest.approx(5.0) 