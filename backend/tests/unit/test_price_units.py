from datetime import date
from unittest.mock import patch

import pandas as pd
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models.market_data import MarketData
from app.utils import stock_cache
from app.utils.stock_cache import repair_unit_slips

SBK_DAYS = ["2025-04-24", "2025-04-25", "2025-04-29"]


def _frame(closes, days=None):
    days = days or [f"2025-04-{d:02d}" for d in range(22, 22 + len(closes))]
    frame = pd.DataFrame(
        {
            "Open": [c * 0.99 for c in closes],
            "High": [c * 1.01 for c in closes],
            "Low": [c * 0.98 for c in closes],
            "Close": closes,
            "Volume": [1000.0] * len(closes),
        },
        index=pd.DatetimeIndex([pd.Timestamp(d) for d in days]),
    )
    frame["Prev Close"] = frame["Close"].shift(1)
    return frame


def test_a_rand_day_between_cents_days_is_scaled_back():
    # r1 = 228.8 / 22769.0 = 0.010049, |100 * r1 - 1| = 0.0049
    # r2 = 23315.5 / 228.8 = 101.903, |r2 / 100 - 1| = 0.019, both inside 0.05
    frame = _frame([22769.0, 228.8, 23315.5], SBK_DAYS)
    frame.loc[pd.Timestamp("2025-04-25"), ["Open", "High", "Low"]] = [227.0, 230.0, 226.0]

    fixed, days = repair_unit_slips("SBK.JO", frame)

    assert days == [date(2025, 4, 25)]
    row = fixed.loc[pd.Timestamp("2025-04-25")]
    assert row["Close"] == pytest.approx(22880.0)
    assert [row["Open"], row["High"], row["Low"]] == pytest.approx([22700.0, 23000.0, 22600.0])
    assert fixed.loc[pd.Timestamp("2025-04-29"), "Prev Close"] == pytest.approx(22880.0)
    assert fixed.loc[pd.Timestamp("2025-04-24"), "Close"] == 22769.0


def test_the_satrix_40_slip_from_the_same_day():
    fixed, days = repair_unit_slips("STX40.JO", _frame([8407.4, 84.4, 8500.3], SBK_DAYS))

    assert days == [date(2025, 4, 25)]
    assert fixed["Close"].iloc[1] == pytest.approx(8440.0)


def test_a_day_100x_too_big_is_divided():
    fixed, days = repair_unit_slips("STX40.JO", _frame([8407.4, 840740.0, 8500.3]))

    assert len(days) == 1
    assert fixed["Close"].iloc[1] == pytest.approx(8407.4)


def test_the_last_row_only_needs_the_day_before():
    fixed, days = repair_unit_slips("SBK.JO", _frame([22769.0, 227.9]))

    assert days == [date(2025, 4, 23)]
    assert fixed["Close"].iloc[1] == pytest.approx(22790.0)


def test_the_first_row_only_needs_the_day_after():
    fixed, days = repair_unit_slips("SBK.JO", _frame([227.6, 22769.0, 22800.0]))

    assert days == [date(2025, 4, 22)]
    assert fixed["Close"].iloc[0] == pytest.approx(22760.0)
    assert fixed["Prev Close"].iloc[1] == pytest.approx(22760.0)


def test_a_real_20_percent_fall_is_left_alone():
    frame = _frame([100.0, 80.0, 82.0])

    fixed, days = repair_unit_slips("SBK.JO", frame)

    assert days == []
    assert fixed["Close"].tolist() == [100.0, 80.0, 82.0]


def test_two_rand_days_in_a_row_are_not_guessed_at():
    fixed, days = repair_unit_slips("SBK.JO", _frame([22769.0, 228.8, 229.1, 23315.5]))

    assert days == []
    assert fixed["Close"].tolist() == [22769.0, 228.8, 229.1, 23315.5]


def test_a_drop_that_lasts_to_the_end_is_a_run_not_a_slip():
    fixed, days = repair_unit_slips("SBK.JO", _frame([22769.0, 22800.0, 228.8, 229.0]))

    assert days == []
    assert fixed["Close"].tolist() == [22769.0, 22800.0, 228.8, 229.0]


def test_two_separate_slips_are_both_repaired():
    fixed, days = repair_unit_slips("SBK.JO", _frame([22769.0, 228.8, 22900.0, 230.0, 23000.0]))

    assert days == [date(2025, 4, 23), date(2025, 4, 25)]
    assert fixed["Close"].tolist() == pytest.approx([22769.0, 22880.0, 22900.0, 23000.0, 23000.0])


def test_a_us_ticker_is_never_touched():
    fixed, days = repair_unit_slips("SPY", _frame([500.0, 5.0, 505.0]))

    assert days == []
    assert fixed["Close"].tolist() == [500.0, 5.0, 505.0]


def test_the_input_frame_is_not_changed():
    frame = _frame([22769.0, 228.8, 23315.5], SBK_DAYS)
    before = frame.copy()

    repair_unit_slips("SBK.JO", frame)

    pd.testing.assert_frame_equal(frame, before)


def test_an_empty_frame_comes_back_empty():
    fixed, days = repair_unit_slips("SBK.JO", pd.DataFrame())

    assert fixed.empty
    assert days == []


def test_saving_yahoo_history_stores_the_repaired_close(db_engine, db_session):
    with patch.object(stock_cache, "SessionLocal", sessionmaker(bind=db_engine)):
        stock_cache._save_price_history("SBK.JO", _frame([22769.0, 228.8, 23315.5], SBK_DAYS))

    rows = {
        r.date: r
        for r in db_session.scalars(select(MarketData).where(MarketData.ticker == "SBK.JO"))
    }
    assert float(rows[date(2025, 4, 25)].close) == pytest.approx(22880.0)
    assert float(rows[date(2025, 4, 29)].prev_close) == pytest.approx(22880.0)


def test_filling_older_history_repairs_too(db_engine, db_session):
    with patch.object(stock_cache, "SessionLocal", sessionmaker(bind=db_engine)):
        added = stock_cache._save_missing_history(
            "SBK.JO", _frame([22769.0, 228.8, 23315.5], SBK_DAYS)
        )

    assert added == 3
    close = db_session.scalar(
        select(MarketData.close).where(
            MarketData.ticker == "SBK.JO", MarketData.date == date(2025, 4, 25)
        )
    )
    assert float(close) == pytest.approx(22880.0)