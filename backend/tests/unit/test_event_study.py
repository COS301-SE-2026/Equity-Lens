import math
from datetime import date, timedelta

import pytest

from app.services.event_study import (
    ESTIMATION_END,
    ESTIMATION_START,
    MIN_OBSERVATIONS,
    aligned_simple_returns,
    run,
)

START = date(2026, 1, 1)

def prices(returns, start_price=100.0):
    out = [(START, start_price)]
    price = start_price
    for i, r in enumerate(returns, start=1):
        price *= 1 + r
        out.append((START + timedelta(days=i), price))
    return out

def market_returns(n):
    pattern = [0.01, -0.006, 0.004, -0.002, 0.008]
    return [pattern[i % len(pattern)] for i in range(n)]

def test_a_stock_that_is_exactly_half_the_market_comes_back_with_beta_one_half():
    market = market_returns(200)
    stock = [0.5 * r for r in market]
    event_day = START + timedelta(days=160)
    result = run(prices(stock), prices(market), event_day)
    assert result["available"] is True
    assert result["beta"] == 0.5
    assert result["alpha"] == 0.0
    assert result["r_squared"] == 1.0
    assert result["residual_sigma"] == 0.0
    assert all(row["abnormal_return_pct"] == 0.0 for row in result["abnormal_returns"])

def test_a_one_off_shock_shows_up_as_the_whole_abnormal_return():
    market = market_returns(200)
    stock = [0.5 * r for r in market]
    event_index = 160
    stock[event_index - 1] -= 0.08
    event_day = START + timedelta(days=event_index)
    result = run(prices(stock), prices(market), event_day)
    on_the_day = next(row for row in result["abnormal_returns"] if row["offset"] == 0)
    assert result["beta"] == 0.5
    assert on_the_day["abnormal_return_pct"] == pytest.approx(-8.0, abs=0.01)
    assert on_the_day["cumulative_abnormal_return_pct"] == pytest.approx(-8.0, abs=0.01)
    assert on_the_day["significant"] is True


def test_the_estimation_window_stops_before_the_event_window():
    market = market_returns(200)
    stock = [0.5 * r for r in market]
    event_day = START + timedelta(days=160)
    result = run(prices(stock), prices(market), event_day)
    assert result["estimation_window"]["offsets"] == [ESTIMATION_START, ESTIMATION_END]
    assert ESTIMATION_END == -21
    assert result["abnormal_returns"][0]["offset"] == -5
    assert result["estimation_window"]["to"] < result["event_window"]["from"]


def test_the_confidence_band_widens_with_the_square_root_of_the_horizon():
    market = market_returns(200)
    stock = [0.5 * r + (0.004 if i % 3 == 0 else -0.002) for i, r in enumerate(market)]
    event_day = START + timedelta(days=160)
    result = run(prices(stock), prices(market), event_day)
    rows = result["abnormal_returns"]

    def half_width(row):
        return (row["car_upper_pct"] - row["car_lower_pct"]) / 2
    assert half_width(rows[3]) == pytest.approx(half_width(rows[0]) * math.sqrt(4), abs=0.02)
    assert half_width(rows[8]) == pytest.approx(half_width(rows[0]) * math.sqrt(9), abs=0.02)


def test_it_refuses_below_sixty_observations_rather_than_fitting_a_line_to_nothing():
    market = market_returns(80)
    stock = [0.5 * r for r in market]
    event_day = START + timedelta(days=70)
    result = run(prices(stock), prices(market), event_day)
    assert result["available"] is False
    assert result["reason"] == "insufficient_history"
    assert result["observations"] < MIN_OBSERVATIONS


def test_a_benchmark_that_never_moves_is_refused_not_divided_by():
    market = [0.0] * 200
    stock = market_returns(200)
    event_day = START + timedelta(days=160)
    result = run(prices(stock), prices(market), event_day)
    assert result["available"] is False
    assert result["reason"] == "benchmark_did_not_move"

def test_an_event_date_with_no_price_is_refused():
    market = market_returns(200)
    stock = [0.5 * r for r in market]
    result = run(prices(stock), prices(market), date(2030, 1, 1))
    assert result["available"] is False
    assert result["reason"] == "event_date_not_in_history"

def test_the_event_window_runs_from_five_before_to_ten_after():
    market = market_returns(220)
    stock = [0.5 * r for r in market]
    event_day = START + timedelta(days=170)
    result = run(prices(stock), prices(market), event_day)
    offsets = [row["offset"] for row in result["abnormal_returns"]]
    assert offsets == list(range(-5, 11))
    assert result["event_window"]["length"] == 16

def _cycled(pattern, n):
    return [pattern[i % len(pattern)] for i in range(n)]

def exact_fit_returns():
    x = _cycled([0.01, -0.01, 0.02, -0.02], 100)
    e = _cycled([0.003, 0.003, -0.003, -0.003], 100)
    return x, [0.48 * m + err for m, err in zip(x, e, strict=True)]

def the_clients_day(after=0):
    x, y = exact_fit_returns()
    market = x + [0.0] * 20 + [-0.004] + [0.0] * after
    stock = y + [0.0] * 20 + [-0.108] + [0.0] * after
    return prices(stock, 50.0), prices(market), START + timedelta(days=121)

def test_beta_and_alpha_come_back_exactly_on_a_constructed_window():
    stock, market, event_day = the_clients_day()
    result = run(stock, market, event_day)
    assert result["observations"] == 100
    assert result["beta"] == 0.48
    assert result["alpha"] == pytest.approx(0.0, abs=1e-12)
    assert result["sigma_ar"] == 0.003015
    assert result["residual_sigma"] == 0.00303
    assert result["alpha_se"] == 0.000303
    assert result["alpha_t"] == pytest.approx(0.0, abs=1e-9)

def test_the_clients_day_is_company_specific_and_outside_its_band():
    stock, market, event_day = the_clients_day()
    result = run(stock, market, event_day)
    day0 = next(row for row in result["abnormal_returns"] if row["offset"] == 0)
    assert day0["stock_return_pct"] == -10.8
    assert day0["market_return_pct"] == -0.4
    assert day0["abnormal_return_pct"] == -10.61
    assert day0["cumulative_abnormal_return_pct"] == -10.61
    assert day0["car_lower_pct"] == pytest.approx(-10.608 - 1.4476, abs=0.01)
    assert day0["car_upper_pct"] == pytest.approx(-10.608 + 1.4476, abs=0.01)
    assert day0["significant"] is True

def test_the_three_numbers_on_the_card_add_up_exactly():
    stock, market, event_day = the_clients_day()

    parts = run(stock, market, event_day)["decomposition"]

    assert parts["stock_return_pct"] == -10.8
    assert parts["market_component_pct"] == -0.19
    assert parts["company_component_pct"] == -10.61
    assert round(parts["market_component_pct"] + parts["company_component_pct"], 2) == -10.8

def test_returns_are_taken_between_days_both_series_have():
    d1, d2, d3, d4 = (START + timedelta(days=i) for i in range(4))
    market = [(d1, 100.0), (d2, 101.0), (d3, 102.01), (d4, 103.0301)]
    stock = [(d1, 50.0), (d2, 50.5), (d4, 51.5)]

    days, r_i, r_m = aligned_simple_returns(stock, market)

    assert days == [d2, d4]
    assert r_i[1] == pytest.approx(0.019802, abs=1e-6)
    assert r_m[1] == pytest.approx(0.0201, abs=1e-9)
    assert r_m[1] != pytest.approx(0.01)

def test_a_pair_further_apart_than_the_detector_allows_is_skipped():
    d1, d2, d8 = START, START + timedelta(days=1), START + timedelta(days=7)
    series = [(d1, 100.0), (d2, 101.0), (d8, 110.0)]

    days, _, _ = aligned_simple_returns(series, series)

    assert days == [d2]

def test_the_after_event_summary_reads_the_last_post_event_row():
    stock, market, event_day = the_clients_day(after=10)

    after = run(stock, market, event_day)["after_event"]

    assert after["days"] == 10
    assert after["car_pct"] == -10.61
    assert after["lower_pct"] == pytest.approx(-10.608 - 2.3638, abs=0.01)
    assert after["upper_pct"] == pytest.approx(-10.608 + 2.3638, abs=0.01)
    assert after["significant"] is True

def test_there_is_no_after_event_summary_with_under_five_days_after():
    stock, market, event_day = the_clients_day(after=4)

    result = run(stock, market, event_day)

    assert result["available"] is True
    assert result["after_event"] is None
    stock, market, event_day = the_clients_day(after=5)
    assert run(stock, market, event_day)["after_event"]["days"] == 5
