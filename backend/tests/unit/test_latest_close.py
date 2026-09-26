from datetime import UTC, date, datetime, timedelta

from app.models.market_data import MarketData
from app.utils.stock_cache import MARKET_DATA_MAX_AGE_DAYS, LatestClose, get_latest_close, is_stale


def add_row(db, day, close, fetched_at=None):
    db.add(MarketData(
        ticker="NPN.JO",
        date=day,
        open=close, high=close, low=close, close=close, prev_close=close - 1,
        volume=100,
        fetched_at=fetched_at or datetime.now(UTC),
    ))
    db.commit()


def test_returns_the_most_recent_row(db_session):
    add_row(db_session, date(2026, 7, 1), 100.0)
    add_row(db_session, date(2026, 7, 3), 120.0)
    add_row(db_session, date(2026, 7, 2), 110.0)

    latest = get_latest_close("NPN.JO", db_session)

    assert isinstance(latest, LatestClose)
    assert latest.date == date(2026, 7, 3)
    assert float(latest.close) == 120.0


def test_matches_on_ticker_case_insensitively(db_session):
    add_row(db_session, date(2026, 7, 1), 100.0)

    assert get_latest_close("npn.jo", db_session) is not None


def test_returns_none_for_an_unknown_ticker(db_session):
    add_row(db_session, date(2026, 7, 1), 100.0)

    assert get_latest_close("NOSUCH", db_session) is None


def test_leaves_a_session_it_was_handed_open(db_session):
    add_row(db_session, date(2026, 7, 1), 100.0)

    get_latest_close("NPN.JO", db_session)

    assert db_session.query(MarketData).count() == 1


def test_is_stale_with_nothing_stored():
    assert is_stale(None) is True


def test_is_stale_when_the_newest_close_is_too_old():
    old_day = datetime.now(UTC).date() - timedelta(days=MARKET_DATA_MAX_AGE_DAYS + 1)
    row = LatestClose(
        date=old_day, close=100.0, prev_close=99.0, volume=1,
        fetched_at=datetime.now(UTC),
    )

    assert is_stale(row) is True


def test_is_not_stale_for_a_fresh_row():
    row = LatestClose(
        date=datetime.now(UTC).date(), close=100.0, prev_close=99.0, volume=1,
        fetched_at=datetime.now(UTC),
    )

    assert is_stale(row) is False
