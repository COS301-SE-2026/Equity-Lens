from datetime import date, timedelta

import pandas as pd
import pytest

from app.services import portfolio_service
from app.services.event_study import run as run_event_study
from app.services.instruments import REGION_EM, REGION_GLOBAL, REGION_SA, REGION_UNKNOWN, REGION_US


def holding(region, value, priced_live=True):
    return {"region": region, "value": value, "priced_live": priced_live, "ticker": "X"}


def _history(start: date, closes: list[float]) -> pd.DataFrame:
    index = pd.to_datetime([start + timedelta(days=i) for i in range(len(closes))])
    return pd.DataFrame({"Close": closes, "Volume": [1] * len(closes)}, index=index)


@pytest.fixture
def fake_history(monkeypatch):

    series: dict[str, pd.DataFrame] = {}

    def fake_get_cached_price_history(symbol, period="1y", force_live=False):
        if symbol not in series:
            raise ValueError(f"no data for {symbol}")
        return series[symbol]

    monkeypatch.setattr(
        portfolio_service, "get_cached_price_history", fake_get_cached_price_history
    )
    return series


def test_weights_come_from_value_not_holding_count():
    holdings = [holding(REGION_SA, 900.0), holding(REGION_US, 100.0)]
    weights = portfolio_service._benchmark_weights(holdings)
    assert weights == {REGION_SA: 0.9, REGION_US: 0.1}


def test_unclassified_holdings_are_excluded_and_the_rest_renormalised():

    holdings = [holding(REGION_SA, 50.0), holding(REGION_UNKNOWN, 50.0)]
    weights = portfolio_service._benchmark_weights(holdings)
    assert weights == {REGION_SA: 1.0}


def test_no_classified_holdings_gives_no_weights():
    assert portfolio_service._benchmark_weights([holding(REGION_UNKNOWN, 100.0)]) == {}
    assert portfolio_service._benchmark_weights([]) == {}


def test_blend_is_weighted_on_returns_not_price_levels(fake_history):
    start = date.today() - timedelta(days=5)

    fake_history["STX40.JO"] = _history(start, [90000.0, 99000.0])
    fake_history["EEM"] = _history(start, [60.0, 60.0])
    fake_history["USDZAR=X"] = _history(start, [18.0, 18.0])

    holdings = [holding(REGION_SA, 50.0), holding(REGION_EM, 50.0)]
    series, components = portfolio_service._benchmark_series(holdings, start, base_value=1000.0)

    assert series[max(series)] == pytest.approx(1050.0)
    assert series[min(series)] == pytest.approx(1000.0)
    assert {c["label"] for c in components} == {"Satrix 40 (JSE Top 40 proxy)", "MSCI EM"}


def test_usd_benchmark_carries_the_currency_move(fake_history):
    start = date.today() - timedelta(days=5)
    fake_history["SPY"] = _history(start, [5000.0, 5000.0])
    fake_history["USDZAR=X"] = _history(start, [18.0, 19.8])

    series, _ = portfolio_service._benchmark_series(
        [holding(REGION_US, 100.0)], start, base_value=1000.0
    )
    assert series[max(series)] == pytest.approx(1100.0)


def test_zar_quoted_benchmark_is_not_fx_converted(fake_history):
    start = date.today() - timedelta(days=5)
    fake_history["STX40.JO"] = _history(start, [90000.0, 90000.0])
    fake_history["USDZAR=X"] = _history(start, [18.0, 25.0])

    series, _ = portfolio_service._benchmark_series(
        [holding(REGION_SA, 100.0)], start, base_value=1000.0
    )
    assert series[max(series)] == pytest.approx(1000.0)


def test_failed_index_fetch_renormalises_over_what_is_left(fake_history):
    start = date.today() - timedelta(days=5)
    fake_history["STX40.JO"] = _history(start, [90000.0, 99000.0])

    holdings = [holding(REGION_SA, 50.0), holding(REGION_EM, 50.0)]
    series, components = portfolio_service._benchmark_series(holdings, start, base_value=1000.0)

    assert series[max(series)] == pytest.approx(1100.0)
    assert [c["label"] for c in components] == ["Satrix 40 (JSE Top 40 proxy)"]


@pytest.mark.usefixtures("fake_history")
def test_all_fetches_failing_gives_an_empty_series():
    start = date.today() - timedelta(days=5)
    series, components = portfolio_service._benchmark_series(
        [holding(REGION_GLOBAL, 100.0)], start, base_value=1000.0
    )
    assert series == {}
    assert components == []


def test_label_names_the_index_when_there_is_only_one():
    single = [{"region": REGION_SA, "label": "JSE ALSI", "weight": 100.0}]
    assert portfolio_service._benchmark_label(single) == "JSE ALSI"
    assert portfolio_service._benchmark_label([]) == "No benchmark"


def test_label_names_every_part_of_a_blend_largest_first():
    blended = [
        {"region": REGION_US, "label": "S&P 500", "weight": 27.6},
        {"region": REGION_SA, "label": "JSE ALSI", "weight": 72.4},
    ]
    assert portfolio_service._benchmark_label(blended) == "JSE ALSI 72% + S&P 500 28%"


def test_the_blend_reports_what_it_was_blended_from(fake_history):
    start = date.today() - timedelta(days=5)
    fake_history["STX40.JO"] = _history(start, [90000.0, 90000.0])
    fake_history["SPY"] = _history(start, [5000.0, 5000.0])
    fake_history["USDZAR=X"] = _history(start, [18.0, 18.0])

    holdings = [holding(REGION_SA, 750.0), holding(REGION_US, 250.0)]
    _, components = portfolio_service._benchmark_series(holdings, start, base_value=1000.0)

    by_region = {c["region"]: c for c in components}
    assert by_region[REGION_SA]["weight"] == pytest.approx(75.0)
    assert by_region[REGION_US]["weight"] == pytest.approx(25.0)
    assert by_region[REGION_US]["label"] == "S&P 500 (SPY ETF proxy)"


def test_benchmark_survives_a_single_snapshot_dated_today(fake_history):
    today = date.today()
    start = today - timedelta(days=10)
    fake_history["STX40.JO"] = _history(start, [90000.0 + (i * 100) for i in range(9)])

    series, components = portfolio_service._benchmark_series(
        [holding(REGION_SA, 100.0)], today, base_value=1000.0
    )
    assert series, "index history ending before the snapshot date must still produce a series"
    assert [c["label"] for c in components] == ["Satrix 40 (JSE Top 40 proxy)"]


def test_baseline_is_the_last_trading_day_at_or_before_the_first_snapshot(fake_history):
    start = date.today() - timedelta(days=10)
    fake_history["STX40.JO"] = _history(start, [100.0, 105.0, 110.0])

    since = start + timedelta(days=1)
    series, _ = portfolio_service._benchmark_series(
        [holding(REGION_SA, 100.0)], since, base_value=1000.0
    )
    assert series[since] == pytest.approx(1000.0)
    assert series[max(series)] == pytest.approx(1000.0 * (110.0 / 105.0))


def test_nearest_benchmark_falls_back_to_the_last_trading_day():
    monday = date(2026, 7, 20)
    saturday = date(2026, 7, 25)
    series = {monday: 1000.0}
    assert portfolio_service._nearest_benchmark(series, [monday], saturday) == 1000.0
    assert portfolio_service._nearest_benchmark(series, [monday], monday) == 1000.0
    assert portfolio_service._nearest_benchmark(series, [monday], date(2026, 7, 1)) is None
    assert portfolio_service._nearest_benchmark({}, [], monday) is None


def test_a_missing_fx_day_uses_the_rate_before_it_not_after(fake_history):
    tuesday = date.today() - timedelta(days=7)
    wednesday = tuesday + timedelta(days=1)
    thursday = tuesday + timedelta(days=2)
    fake_history["SPY"] = _history(tuesday, [100.0, 100.0, 100.0])
    fake_history["USDZAR=X"] = pd.DataFrame(
        {"Close": [18.0, 20.0]}, index=pd.to_datetime([tuesday, thursday])
    )

    levels = portfolio_service._index_levels("SPY", "USD", tuesday)

    assert levels == {tuesday: 1800.0, wednesday: 1800.0, thursday: 2000.0}


def test_a_day_before_the_first_fx_close_is_dropped_not_guessed(fake_history):
    monday = date.today() - timedelta(days=8)
    tuesday = monday + timedelta(days=1)
    fake_history["SPY"] = _history(monday, [100.0, 100.0])
    fake_history["USDZAR=X"] = _history(tuesday, [18.0])

    levels = portfolio_service._index_levels("SPY", "USD", monday)

    assert levels == {tuesday: 1800.0}


def test_a_dollar_holding_is_measured_against_the_index_in_dollars(fake_history):
    start = date.today() - timedelta(days=300)
    pattern = [0.01, -0.006, 0.004, -0.002, 0.008]
    market = [pattern[i % 5] for i in range(200)]
    spy, stock = [500.0], [50.0]
    for r in market:
        spy.append(spy[-1] * (1 + r))
        stock.append(stock[-1] * (1 + 0.5 * r))
    fake_history["SPY"] = _history(start, spy)
    fake_history["USDZAR=X"] = _history(start, [23.0 if i % 3 else 14.0 for i in range(201)])
    stock_series = [(start + timedelta(days=i), p) for i, p in enumerate(stock)]
    event_day = start + timedelta(days=160)

    _, in_dollars = portfolio_service.benchmark_levels(REGION_US, start, "USD")
    _, in_rand = portfolio_service.benchmark_levels(REGION_US, start)

    assert run_event_study(stock_series, sorted(in_dollars.items()), event_day)["beta"] == 0.5
    assert run_event_study(stock_series, sorted(in_rand.items()), event_day)["beta"] != 0.5
    assert in_dollars[start] == 500.0


def test_a_rand_index_cannot_be_asked_for_in_dollars(fake_history):
    start = date.today() - timedelta(days=5)
    fake_history["STX40.JO"] = _history(start, [90000.0, 90000.0])

    assert portfolio_service.benchmark_levels(REGION_SA, start, "USD") is None


