from datetime import date, timedelta
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

from app.models.portfolio import (
    Holdings,
    InstrumentPurchasesAndSales,
    Portfolios,
    PortfolioSnapshot,
)
from app.services import portfolio_service
from app.services.portfolio_service import PortfolioService
from app.services.returns import benchmark_mirror, period_flows, time_weighted_index


def rows(values, levels, flows):
    return [
        {"value": v, "benchmark": b, "net_flow": f}
        for v, b, f in zip(values, levels, flows, strict=True)
    ]


def mirrors(result):
    return [r["benchmark_mirror"] for r in result]


def test_with_no_flows_the_mirror_is_the_benchmark_rebased_to_the_first_value():
    result = benchmark_mirror(rows([1000, 1040, 990], [100, 105, 98], [0, 0, 0]))

    assert mirrors(result) == [1000.0, 1050.0, 980.0]
    assert not any(r["mirror_exhausted"] for r in result)


def test_a_buy_then_a_sale_go_into_the_benchmark_on_the_same_days():
    result = benchmark_mirror(
        rows([1000, 1550, 1500, 1300], [100, 110, 121, 110], [0, 500, -300, 0])
    )

    assert mirrors(result) == [1000.0, 1600.0, 1460.0, 1327.27]


def test_the_same_rand_in_both_cancels_out_of_the_gap():
    result = benchmark_mirror(rows([1000, 1550], [100, 110], [0, 500]))

    assert result[1]["benchmark_mirror"] - result[1]["value"] == pytest.approx(50.0)


def test_the_gap_only_moves_with_the_difference_in_growth():
    rng = np.random.default_rng(20)
    for _ in range(200):
        values, levels, flows, growths = [rng.uniform(500, 5000)], [100.0], [0.0], [None]
        for _ in range(rng.integers(2, 13)):
            g_bench = rng.uniform(0.95, 1.05)
            g_port = rng.uniform(0.95, 1.05)
            options = [0.0, rng.uniform(0, 800), -rng.uniform(0, values[-1] * 0.3)]
            flow = options[rng.integers(3)]
            levels.append(levels[-1] * g_bench)
            values.append(values[-1] * g_port + flow)
            flows.append(flow)
            growths.append((g_bench, g_port))

        result = benchmark_mirror(rows(values, levels, flows))

        for d in range(1, len(result)):
            g_bench, g_port = growths[d]
            gap = result[d]["benchmark_mirror"] - values[d]
            expected = result[d - 1]["benchmark_mirror"] * g_bench - values[d - 1] * g_port
            assert gap == pytest.approx(expected, abs=0.02)
            assert not result[d]["mirror_exhausted"]


def test_a_sale_bigger_than_the_mirror_empties_it_and_a_later_buy_restarts_it():
    result = benchmark_mirror(rows([1000, 0, 200], [100, 50, 60], [0, -1100, 200]))

    assert mirrors(result) == [1000.0, 0.0, 200.0]
    assert [r["mirror_exhausted"] for r in result] == [False, True, False]


def test_a_full_exit_while_behind_leaves_the_mirror_invested():
    result = benchmark_mirror(rows([1000, 900, 0, 0], [100, 110, 110, 121], [0, 0, -900, 0]))

    assert mirrors(result) == [1000.0, 1100.0, 200.0, 220.0]
    assert not any(r["mirror_exhausted"] for r in result)


def test_flows_on_or_before_the_first_row_are_not_counted_twice():
    days = [date(2026, 3, 2), date(2026, 3, 3)]
    flows = [(date(2026, 2, 20), 700.0), (date(2026, 3, 2), 300.0), (date(2026, 3, 3), 50.0)]

    net = period_flows(days, flows)
    result = benchmark_mirror(rows([1000, 1050], [100, 100], net))

    assert net == [0.0, 50.0]
    assert mirrors(result) == [1000.0, 1050.0]


def test_rows_before_a_late_benchmark_have_no_mirror():
    result = benchmark_mirror(
        rows([1000, 1100, 1200, 1300], [None, None, 50, 55], [0, 100, 0, 100])
    )

    assert mirrors(result) == [None, None, 1200.0, 1420.0]


def test_a_weekend_flow_lands_on_the_next_row_like_the_time_weighted_index():
    friday, monday = date(2026, 3, 6), date(2026, 3, 9)
    flows = [(date(2026, 3, 7), 200.0)]
    snapshots = [(friday, 1000.0), (monday, 1230.0)]

    net = period_flows([friday, monday], flows)
    twr = time_weighted_index(snapshots, flows)
    result = benchmark_mirror(rows([1000, 1230], [100, 103], net))

    assert net == [0.0, 200.0]
    assert twr[1][1] == pytest.approx(103.0)
    assert mirrors(result) == [1000.0, 1230.0]


DAYS = [date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 3), date(2026, 9, 4)]


@pytest.fixture
def traded_portfolio(db_session, test_user):
    portfolio_service._snapshot_maintenance_done.clear()
    portfolio_service.invalidate_priced_holdings()
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-MIRROR", portfolio_name="EasyEquities",
        currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()

    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Naspers Limited", ticker="NPN.JO",
        sector="Technology", quantity=10, cost_price=120, total_cost=1200,
    ))
    for day, value in zip(DAYS, [1000, 1550, 1500, 1300], strict=True):
        db_session.add(PortfolioSnapshot(
            portfolio_id=portfolio.id, snapshot_date=day, total_value=value,
        ))
    for day, name, value in (
        (date(2026, 8, 25), "Buy", 1000),
        (date(2026, 9, 2), "Buy", 500),
        (date(2026, 9, 4), "Sale", 300),
    ):
        db_session.add(InstrumentPurchasesAndSales(
            portfolio_id=portfolio.id, transaction_date=day, transaction_name=name,
            instrument_name="Naspers Limited", ticker="NPN.JO", quantity=1, value_zar=value,
        ))
    db_session.commit()

    closes = pd.DataFrame(
        {"Close": [100.0, 110.0, 121.0, 110.0], "Volume": [1] * 4},
        index=pd.to_datetime(DAYS),
    )

    def fake_history(symbol, period="1y", force_live=False, start=None):
        if symbol != "STX40.JO":
            raise ValueError(f"no data for {symbol}")
        return closes

    with (
        patch.object(portfolio_service, "get_cached_price_history", fake_history),
        patch.object(portfolio_service, "_history_is_incomplete", return_value=False),
        patch.object(portfolio_service.PortfolioRepository, "upsert_snapshot"),
    ):
        yield portfolio

    portfolio_service._snapshot_maintenance_done.clear()
    portfolio_service.invalidate_priced_holdings()


@pytest.mark.usefixtures("traded_portfolio")
def test_the_dashboard_rows_carry_the_same_money_line(db_session, test_user):
    history = PortfolioService(db_session).get_dashboard(test_user.id)["performanceHistory"]

    assert [r["benchmark"] for r in history] == [1000.0, 1100.0, 1210.0, 1100.0]
    assert [r["net_flow"] for r in history] == [0.0, 500.0, 0.0, -300.0]
    assert sum(r["net_flow"] for r in history) == 200.0
    assert [r["benchmark_mirror"] for r in history] == [1000.0, 1600.0, 1760.0, 1300.0]
    assert [r["mirror_exhausted"] for r in history] == [False] * 4
    assert history[-1]["twr_index"] is not None


@pytest.mark.usefixtures("traded_portfolio")
def test_the_performance_route_returns_the_new_fields(client, auth_headers):
    response = client.get("/api/portfolio/performance", headers=auth_headers)

    assert response.status_code == 200
    rows = response.json()
    assert {"net_flow", "benchmark_mirror", "mirror_exhausted"} <= set(rows[0])
    assert [r["benchmark_mirror"] for r in rows] == [r["benchmark"] for r in rows]


def test_a_day_with_no_snapshot_history_still_gives_no_rows():
    assert benchmark_mirror([]) == []
    assert period_flows([], [(date.today() - timedelta(days=1), 10.0)]) == []