"""XIRR, time-weighted return and average-cost realised gain.

Every expected value below is worked out by hand in the comment above it. That is the point of
the file: these three are the numbers the dashboard reports as "your return", and a test whose
expectation came out of the code it is testing proves nothing about whether the maths is right.
"""
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
    # put in 1000, take out 1100 exactly 365 days later. at r = 10%:
    #   -1000 / 1.1^0 + 1100 / 1.1^1 = -1000 + 1000 = 0
    # so the rate that zeroes the NPV is 10%
    flows = [(date(2025, 1, 1), -1000.0), (date(2026, 1, 1), 1100.0)]

    assert xirr(flows) == pytest.approx(10.0, abs=1e-4)


def test_xirr_compounds_over_two_years():
    # -1000 now, +1210 in 730 days. 730/365 = 2 years, and 1.1^2 = 1.21, so 1000 x 1.21 = 1210
    # lands exactly on 10% again - the same rate, compounded rather than doubled
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
    # a rate needs a sign change to exist at all. reporting a number here would be inventing one
    assert xirr(flows) is None, why


def test_time_weighted_index_removes_a_deposit_from_the_return():
    # 100 -> 110 is +10%. then 99 is deposited and the book ends at 220, which looks like +100%
    # but is not: (220 - 99) / 110 = 121/110 = +10% again.
    # chained: 1.10 x 1.10 = 1.21, so the index runs 100, 110, 121
    snapshots = [
        (date(2026, 1, 1), 100.0),
        (date(2026, 2, 1), 110.0),
        (date(2026, 3, 1), 220.0),
    ]
    flows = [(date(2026, 2, 15), 99.0)]

    index = time_weighted_index(snapshots, flows)

    assert [round(value, 6) for _, value in index] == [100.0, 110.0, 121.0]


def test_time_weighted_return_is_the_index_end_to_end():
    # the same book: 121 / 100 - 1 = 21%. the deposit is not a return and does not appear
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
    # buy 10 at 100 (1000) then 10 at 200 (2000): 20 held, 3000 of cost, average 150 each.
    # sell 10 for 2000 -> cost basis sold is 150 x 10 = 1500, so the realised gain is
    # 2000 - 1500 = 500. selling FIFO would have said 2000 - 1000 = 1000, which is the whole
    # reason the method has to be stated rather than assumed
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "buy", 10, 2000.0),
        _txn("NPN.JO", 3, "sell", 10, 2000.0),
    ]

    assert average_cost_realised_gain(txns) == pytest.approx(500.0)


def test_average_cost_positions_carries_the_remaining_cost():
    # same ledger: 10 shares left, and 3000 - 1500 = 1500 of cost still attached to them
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "buy", 10, 2000.0),
        _txn("NPN.JO", 3, "sell", 10, 2000.0),
    ]

    positions = average_cost_positions(txns)

    assert positions["NPN.JO"]["qty"] == pytest.approx(10.0)
    assert positions["NPN.JO"]["cost"] == pytest.approx(1500.0)


def test_a_sale_larger_than_the_position_is_clamped_not_negative():
    # the statement says sell 15 of a 10-share position. clamped to 10: average cost is
    # 1000/10 = 100, cost basis sold 1000, and proceeds are pro-rated 1500 x (10/15) = 1000,
    # so the realised gain is 0 rather than a position going negative
    txns = [
        _txn("NPN.JO", 1, "buy", 10, 1000.0),
        _txn("NPN.JO", 2, "sell", 15, 1500.0),
    ]

    assert average_cost_realised_gain(txns) == pytest.approx(0.0)
    assert average_cost_positions(txns)["NPN.JO"]["qty"] == pytest.approx(0.0)


def test_pct_return_divides_and_refuses_a_zero_base():
    # 500 on 2000 invested = 25%
    assert pct_return(500.0, 2000.0) == pytest.approx(25.0)
    # nothing invested is not a 0% return, it is no return at all
    assert pct_return(500.0, 0.0) is None
