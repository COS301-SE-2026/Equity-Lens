import pandas as pd
import pytest

from app.services.risk_analytics import (
    MIN_HISTORY_DAYS,
    TRADING_DAYS_PER_YEAR,
    annualized_return_pct,
    annualized_volatility_pct,
    portfolio_beta,
)


def test_a_series_that_averages_nothing_annualises_to_nothing():
    returns = pd.Series([0.01, -0.01, 0.01, -0.01])

    assert annualized_return_pct(returns) == pytest.approx(0.0, abs=1e-12)


def test_a_steady_daily_gain_compounds_over_the_trading_year():
    returns = pd.Series([0.001] * 30)

    assert annualized_return_pct(returns) == pytest.approx(28.6428, abs=1e-3)


def test_volatility_scales_by_the_root_of_the_trading_year():
    returns = pd.Series([0.01, -0.01, 0.01, -0.01])

    assert annualized_volatility_pct(returns) == pytest.approx(18.3303, abs=1e-3)


def test_a_flat_series_has_no_volatility():
    assert annualized_volatility_pct(pd.Series([0.002] * 10)) == pytest.approx(0.0)


def test_the_trading_year_is_252_days_not_365():
    assert TRADING_DAYS_PER_YEAR == 252


def test_beta_against_itself_is_one():
    days = pd.date_range("2026-01-01", periods=40, freq="D")
    series = pd.Series([0.01, -0.005, 0.002, 0.008] * 10, index=days)

    assert portfolio_beta(series, series) == pytest.approx(1.0, abs=1e-9)


def test_beta_refuses_a_history_too_short_to_mean_anything():
    days = pd.date_range("2026-01-01", periods=MIN_HISTORY_DAYS - 10, freq="D")
    series = pd.Series([0.01, -0.005] * ((MIN_HISTORY_DAYS - 10) // 2), index=days)

    assert portfolio_beta(series, series) is None


def test_beta_refuses_when_the_two_series_barely_overlap():
    portfolio = pd.Series([0.01, -0.005] * 20, index=pd.date_range("2026-01-01", periods=40))
    benchmark = pd.Series([0.01, -0.005] * 20, index=pd.date_range("2026-02-05", periods=40))

    assert portfolio_beta(portfolio, benchmark) is None
