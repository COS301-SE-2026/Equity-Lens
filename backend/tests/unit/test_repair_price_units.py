import logging
from datetime import UTC, date, datetime
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models.market_data import MarketData
from app.scripts import repair_price_units

SBK = [(date(2025, 4, 24), 22769.0), (date(2025, 4, 25), 228.8), (date(2025, 4, 29), 23315.5)]
STX40 = [(date(2025, 4, 24), 8407.4), (date(2025, 4, 25), 84.4), (date(2025, 4, 29), 8500.3)]
NPN = [(date(2025, 4, 24), 410000.0), (date(2025, 4, 25), 412000.0), (date(2025, 4, 29), 409000.0)]
SOL_RUN = [
    (date(2025, 4, 24), 22769.0),
    (date(2025, 4, 25), 228.8),
    (date(2025, 4, 28), 229.1),
    (date(2025, 4, 29), 23315.5),
]


@pytest.fixture
def prices(db_engine, db_session):
    def store(ticker, days):
        prev = days[0][1]
        for day, close in days:
            db_session.add(MarketData(
                ticker=ticker, date=day, open=close, high=close, low=close, close=close,
                prev_close=prev, volume=1, fetched_at=datetime.now(UTC),
            ))
            prev = close
        db_session.commit()

    with patch.object(repair_price_units, "SessionLocal", sessionmaker(bind=db_engine)):
        yield store


def _closes(db_session, ticker):
    db_session.expire_all()
    rows = db_session.scalars(
        select(MarketData).where(MarketData.ticker == ticker).order_by(MarketData.date)
    )
    return [(float(r.open), float(r.high), float(r.low), float(r.close), float(r.prev_close))
            for r in rows]


def test_a_dry_run_reports_the_repair_and_changes_nothing(prices, db_session, caplog):
    prices("SBK.JO", SBK)
    prices("NPN.JO", NPN)
    before = _closes(db_session, "SBK.JO")
    caplog.set_level(logging.INFO)

    assert repair_price_units.main([]) == 0

    assert "SBK.JO 2025-04-25 close 228.8 -> 22880.0" in caplog.text
    assert "would repair 1 prices" in caplog.text
    assert _closes(db_session, "SBK.JO") == before


def test_apply_scales_the_bad_day_and_fixes_the_next_prev_close(prices, db_session):
    prices("SBK.JO", SBK)
    prices("NPN.JO", NPN)
    npn = _closes(db_session, "NPN.JO")

    assert repair_price_units.main(["--apply"]) == 0

    rows = _closes(db_session, "SBK.JO")
    assert rows[1][:4] == pytest.approx([22880.0] * 4)
    assert rows[2][4] == pytest.approx(22880.0)
    assert rows[0] == (22769.0, 22769.0, 22769.0, 22769.0, 22769.0)
    assert _closes(db_session, "NPN.JO") == npn


def test_naming_a_ticker_scans_only_that_one(prices, db_session):
    prices("SBK.JO", SBK)
    prices("STX40.JO", STX40)

    repair_price_units.main(["--apply", "SBK.JO"])

    assert _closes(db_session, "SBK.JO")[1][3] == pytest.approx(22880.0)
    assert _closes(db_session, "STX40.JO")[1][3] == 84.4


def test_two_rand_days_are_reported_not_changed(prices, db_session, caplog):
    prices("SOL.JO", SOL_RUN)
    before = _closes(db_session, "SOL.JO")
    caplog.set_level(logging.INFO)

    repair_price_units.main(["--apply"])

    assert "SOL.JO 2025-04-25 to 2025-04-28" in caplog.text
    assert "needs a look" in caplog.text
    assert _closes(db_session, "SOL.JO") == before
