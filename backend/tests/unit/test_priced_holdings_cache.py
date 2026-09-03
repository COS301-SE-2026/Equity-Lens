from datetime import date
import pytest

from app.services.returns import (
    average_cost_positions,
    average_cost_realised_gain,
    pct_return,
    time_weighted_index,
    time_weighted_return_pct,
    xirr,
)


@pytest.fixture
def make_txn():
    """Factory fixture for building transaction dicts with consistent defaults."""
    def _factory(ticker, date_val, side, quantity, value_zar):
        return {
            "ticker": ticker,
            "date": date_val,
            "side": side,
            "quantity": quantity,
            "value_zar": value_zar,
        }
    return _factory

def test_twr_no_cash_flows_doubling():
    snapshots = [(date(2026, 1, 1), 100.0), (date(2026, 6, 1), 200.0)]
    assert time_weighted_return_pct(snapshots, []) == pytest.approx(100.0)


def test_twr_unaffected_by_zero_earning_cash_flow():
    no_flow = time_weighted_return_pct(
        [(date(2026, 1, 1), 100.0), (date(2026, 6, 1), 150.0)],
        [],
    )
    with_flow = time_weighted_return_pct(
        [(date(2026, 1, 1), 100.0), (date(2026, 6, 1), 200.0)],
        [(date(2026, 3, 1), 50.0)],
    )

    assert with_flow == pytest.approx(no_flow)
    assert with_flow == pytest.approx(50.0)


def test_twr_returns_none_insufficient_snapshots():
    assert time_weighted_return_pct([], []) is None
    assert time_weighted_return_pct([(date(2026, 1, 1), 100.0)], []) is None


def test_twr_index_base_and_end_points():
    snapshots = [
        (date(2026, 1, 1), 100.0),
        (date(2026, 4, 1), 150.0),
        (date(2026, 7, 1), 180.0),
    ]

    index = time_weighted_index(snapshots, [])

    assert index[0] == (date(2026, 1, 1), 100.0)
    assert index[-1][1] == pytest.approx(180.0)
    assert time_weighted_return_pct(snapshots, []) == pytest.approx(80.0)


def test_twr_index_sub_period_return_matching():
    snapshots = [
        (date(2026, 1, 1), 100000.0),
        (date(2026, 4, 1), 152000.0),
        (date(2026, 7, 1), 159600.0),
    ]
    flows = [(date(2026, 3, 1), 50000.0)]

    index_map = dict(time_weighted_index(snapshots, flows))

    assert index_map[date(2026, 4, 1)] == pytest.approx(102.0)

    q2_return = (index_map[date(2026, 7, 1)] / index_map[date(2026, 4, 1)] - 1) * 100
    assert q2_return == pytest.approx(5.0)
    assert time_weighted_return_pct(snapshots[1:], flows) == pytest.approx(5.0)


def test_twr_index_handles_initial_zero_balance():
    snapshots = [
        (date(2026, 1, 1), 0.0),
        (date(2026, 2, 1), 1000.0),
        (date(2026, 3, 1), 1100.0),
    ]
    flows = [(date(2026, 1, 15), 1000.0)]

    index = time_weighted_index(snapshots, flows)

    assert len(index) == len(snapshots)
    assert index[1][1] == pytest.approx(100.0)
    assert index[2][1] == pytest.approx(110.0)


def test_twr_index_returns_empty_when_insufficient_data():
    assert time_weighted_index([], []) == []
    assert time_weighted_index([(date(2026, 1, 1), 100.0)], []) == []



def test_xirr_single_annual_contribution():
    flows = [(date(2025, 1, 1), -100.0), (date(2026, 1, 1), 110.0)]
    assert xirr(flows) == pytest.approx(10.0, abs=0.5)


def test_xirr_vs_twr_divergence_on_timed_cash_flow():
    snapshots = [(date(2026, 1, 1), 10000.0), (date(2026, 3, 1), 52000.0)]
    twr = time_weighted_return_pct(snapshots, [(date(2026, 2, 25), 40000.0)])

    mwr_flows = [
        (date(2026, 1, 1), -10000.0),
        (date(2026, 2, 25), -40000.0),
        (date(2026, 3, 1), 52000.0),
    ]
    mwr = xirr(mwr_flows)

    assert twr is not None
    assert mwr is not None
    assert abs(twr - mwr) > 5.0


def test_xirr_requires_directional_cash_flow_mix():
    only_outflows = [(date(2026, 1, 1), -100.0), (date(2026, 6, 1), -50.0)]
    assert xirr(only_outflows) is None


def test_xirr_handles_non_convergence_gracefully():
    assert xirr([(date(2026, 1, 1), -100.0)]) is None


def test_xirr_handles_divergent_newton_steps():
    pathological_flows = [
        (date(2026, 1, 1), -100.0),
        (date(2026, 1, 2), 1000.0),
        (date(2026, 1, 3), -10000.0),
        (date(2026, 1, 4), 100000.0),
    ]
    assert xirr(pathological_flows) is None


def test_xirr_standard_annualized_growth():
    flows = [(date(2025, 9, 2), -100000.0), (date(2026, 9, 2), 112000.0)]
    assert xirr(flows) == pytest.approx(12.0, abs=0.05)


def test_pct_return_zero_base_safety():
    assert pct_return(500.0, 0.0) is None
    assert pct_return(0.0, 0.0) is None
    assert pct_return(50.0, 200.0) == pytest.approx(25.0)


def test_average_cost_realised_gain_partial_sell(make_txn):
    txns = [
        make_txn("NPN.JO", date(2026, 1, 1), "buy", 10, 1000.0),
        make_txn("NPN.JO", date(2026, 2, 1), "buy", 10, 1400.0),
        make_txn("NPN.JO", date(2026, 3, 1), "sell", 5, 750.0),
    ]
    assert average_cost_realised_gain(txns) == pytest.approx(150.0)


def test_average_cost_realised_gain_clamps_oversold(make_txn):
    txns = [
        make_txn("BAD.JO", date(2026, 1, 1), "buy", 5, 500.0),
        make_txn("BAD.JO", date(2026, 2, 1), "sell", 50, 6000.0),
    ]
    assert average_cost_realised_gain(txns) == pytest.approx(100.0)


def test_average_cost_positions_running_cost_basis(make_txn):
    txns = [
        make_txn("NPN.JO", date(2026, 1, 1), "buy", 10, 1000.0),
        make_txn("NPN.JO", date(2026, 2, 1), "buy", 10, 1400.0),
        make_txn("NPN.JO", date(2026, 3, 1), "sell", 5, 750.0),
    ]
    positions = average_cost_positions(txns)

    assert positions["NPN.JO"]["qty"] == pytest.approx(15.0)
    assert positions["NPN.JO"]["cost"] == pytest.approx(1800.0)
    assert average_cost_realised_gain(txns) == pytest.approx(150.0)


def test_average_cost_positions_resets_on_full_exit(make_txn):
    txns = [
        make_txn("BAD.JO", date(2026, 1, 1), "buy", 5, 500.0),
        make_txn("BAD.JO", date(2026, 2, 1), "sell", 5, 6000.0),
    ]
    positions = average_cost_positions(txns)

    assert positions["BAD.JO"]["qty"] == pytest.approx(0.0)
    assert positions["BAD.JO"]["cost"] == pytest.approx(0.0)