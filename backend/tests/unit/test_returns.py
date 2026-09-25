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


def test_xirr_on_a_single_year_round_trip():
    flows = [(date(2025, 1, 1), -1000.0), (date(2026, 1, 1), 1100.0)]

    assert xirr(flows) == pytest.approx(10.0, abs=1e-4)


def test_xirr_compounds_over_two_years():
    flows = [(date(2025, 1, 1), -1000.0), (date(2027, 1, 1), 1210.0)]

    assert xirr(flows) == pytest.approx(10.0, abs=1e-4)


@pytest.mark.parametrize(
    ("flows", "why"),
    [
        ([(date(2025, 1, 1), -1000.0)], "one flow has no return to solve for"),
        ([(date(2025, 1, 1), 500.0), (date(2026, 1, 1), 500.0)], "all deposits, never withdrawn"),
        ([(date(2025, 1, 1), -500.0), (date(2026, 1, 1), -500.0)], "all withdrawals, never funded"),
    ],
)
def test_xirr_refuses_rather_than_guessing(flows, why):
    assert xirr(flows) is None, why


def test_time_weighted_index_removes_a_deposit_from_the_return():
    snapshots = [
        (date(2026, 1, 1), 100.0),
        (date(2026, 2, 1), 110.0),
        (date(2026, 3, 1), 220.0),
    ]
    flows = [(date(2026, 2, 15), 99.0)]

    index = time_weighted_index(snapshots, flows)

    assert [round(value, 6) for _, value in index] == [100.0, 110.0, 121.0]


def test_time_weighted_return_is_the_index_end_to_end():
    snapshots = [
        (date(2026, 1, 1), 100.0),
        (date(2026, 2, 1), 110.0),
        (date(2026, 3, 1), 220.0),
    ]
    flows = [(date(2026, 2, 15), 99.0)]

    assert time_weighted_return_pct(snapshots, flows) == pytest.approx(21.0, abs=1e-9)


def test_time_weighted_return_refuses_a_single_snapshot():
    assert time_weighted_return_pct([(date(2026, 1, 1), 100.0)], []) is None


def _txn(ticker, day, side, quantity, value_zar):
    return {
        "ticker": ticker, "date": date(2026, 1, day), "side": side,
        "quantity": quantity, "value_zar": value_zar,
    }


def test_average_cost_realised_gain_uses_the_blended_cost():
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "buy", 10, 2000.0),
        _txn("NPN.JO", 3, "sell", 10, 2000.0),
    ]

    assert average_cost_realised_gain(txns) == pytest.approx(500.0)


def test_average_cost_positions_carries_the_remaining_cost():
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "buy", 10, 2000.0),
        _txn("NPN.JO", 3, "sell", 10, 2000.0),
    ]

    positions = average_cost_positions(txns)

    assert positions["NPN.JO"]["qty"] == pytest.approx(10.0)
    assert positions["NPN.JO"]["cost"] == pytest.approx(1500.0)


def test_a_sale_larger_than_the_position_is_clamped_not_negative():
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "sell", 15, 1500.0),
    ]

    assert average_cost_realised_gain(txns) == pytest.approx(0.0)
    assert average_cost_positions(txns)["NPN.JO"]["qty"] == pytest.approx(0.0)


def test_pct_return_divides_and_refuses_a_zero_base():
    assert pct_return(500.0, 2000.0) == pytest.approx(25.0)
    assert pct_return(500.0, 0.0) is None
