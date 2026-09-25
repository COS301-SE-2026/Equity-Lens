"""Annualised return, annualised volatility and beta.

These three take a daily-return series and scale it to a year. The scaling is the part worth
testing - everything above it in the module is a cache read - so the series here are built by
hand rather than fetched, and every expected value is worked out in the comment.
"""
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
    # +1%, -1%, +1%, -1% has a mean daily return of exactly 0, and (1 + 0)^252 - 1 = 0.
    # note this is not the same as the book being flat - compounding -1% after +1% loses
    # money - it is the mean of the daily returns that is zero, which is what this scales
    returns = pd.Series([0.01, -0.01, 0.01, -0.01])

    assert annualized_return_pct(returns) == pytest.approx(0.0, abs=1e-12)


def test_a_steady_daily_gain_compounds_over_the_trading_year():
    # a constant 0.1% a day. mean is 0.001, so 1.001^252 - 1.
    # 252 x ln(1.001) = 252 x 0.00099950 = 0.2518737, and e^0.2518737 = 1.286428
    # so the annualised figure is 28.6428%, not 252 x 0.1% = 25.2% - the difference is the
    # compounding, and it is why this is not a multiplication
    returns = pd.Series([0.001] * 30)

    assert annualized_return_pct(returns) == pytest.approx(28.6428, abs=1e-3)


def test_volatility_scales_by_the_root_of_the_trading_year():
    # +1%, -1%, +1%, -1%: mean 0, so the sample variance is sum(x^2)/(n-1) = 4 x 0.0001 / 3,
    # and the daily standard deviation is 0.01 x sqrt(4/3) = 0.011547005.
    # annualising multiplies by sqrt(252) = 15.8745079:
    #   0.011547005 x 15.8745079 = 0.1833030 -> 18.3303%
    # pandas uses the sample standard deviation (ddof=1), which is the /3 rather than /4
    returns = pd.Series([0.01, -0.01, 0.01, -0.01])

    assert annualized_volatility_pct(returns) == pytest.approx(18.3303, abs=1e-3)


def test_a_flat_series_has_no_volatility():
    # every day identical, so there is no dispersion to annualise
    assert annualized_volatility_pct(pd.Series([0.002] * 10)) == pytest.approx(0.0)


def test_the_trading_year_is_252_days_not_365():
    # the constant the two functions above are built on. markets are shut at weekends, so
    # annualising a daily figure over 365 would overstate both
    assert TRADING_DAYS_PER_YEAR == 252


def test_beta_against_itself_is_one():
    # beta is cov(p, b) / var(b). when the portfolio IS the benchmark that is var/var = 1,
    # whatever the series looks like, so this checks the wiring without needing a second
    # hand-computed covariance
    days = pd.date_range("2026-01-01", periods=40, freq="D")
    series = pd.Series([0.01, -0.005, 0.002, 0.008] * 10, index=days)

    assert portfolio_beta(series, series) == pytest.approx(1.0, abs=1e-9)


def test_beta_refuses_a_history_too_short_to_mean_anything():
    # 20 overlapping days is under MIN_HISTORY_DAYS, and a beta off 20 points is noise
    # presented as a risk measure
    days = pd.date_range("2026-01-01", periods=MIN_HISTORY_DAYS - 10, freq="D")
    series = pd.Series([0.01, -0.005] * ((MIN_HISTORY_DAYS - 10) // 2), index=days)

    assert portfolio_beta(series, series) is None


def test_beta_refuses_when_the_two_series_barely_overlap():
    # both series are long enough on their own, but they only share a handful of dates once
    # aligned, and it is the overlap that the calculation actually uses
    portfolio = pd.Series([0.01, -0.005] * 20, index=pd.date_range("2026-01-01", periods=40))
    benchmark = pd.Series([0.01, -0.005] * 20, index=pd.date_range("2026-02-05", periods=40))

    assert portfolio_beta(portfolio, benchmark) is None
