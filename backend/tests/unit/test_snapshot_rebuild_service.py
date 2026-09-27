from datetime import date, timedelta

import pytest

from app.models.market_data import MarketData
from app.models.portfolio import Holdings, Portfolios
from app.services.snapshot_rebuild_service import (
    MIN_COVERAGE_PCT,
    SPLIT_SUSPECT_PCT,
    position_on,
    prices_by_day,
    rebuild_snapshots,
)

DAY1 = date.today() - timedelta(days=10)
DAY2 = DAY1 + timedelta(days=1)
DAY3 = DAY1 + timedelta(days=2)
DAY4 = DAY1 + timedelta(days=3)


@pytest.fixture
def portfolio(db_session, test_user):
    row = Portfolios(
        user_id=test_user.id, account_number="EE-R", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(row)
    db_session.commit()
    return row


def _hold(db_session, portfolio, ticker, quantity, cost_price):
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name=ticker, ticker=ticker, sector="Technology",
        quantity=quantity, cost_price=cost_price, total_cost=quantity * cost_price,
    ))
    db_session.commit()


def _price(db_session, ticker, day, rands):
    cents = rands * 100
    db_session.add(MarketData(
        ticker=ticker, date=day, open=cents, high=cents, low=cents,
        close=cents, prev_close=cents, volume=1,
    ))
    db_session.commit()


def _txn(ticker, day, side, quantity):
    return {"ticker": ticker, "date": day, "side": side, "quantity": quantity, "value_zar": 0.0}


def _snapshots(db_session, portfolio):
    from app.repositories.portfolio_repository import PortfolioRepository
    return {
        row["snapshot_date"]: row["total_value"]
        for row in PortfolioRepository(db_session).get_snapshot_history([portfolio.id])
    }


def test_prices_by_day_carries_forward_but_never_backwards():
    observed = {DAY3: 120.0}
    resolved, gaps = prices_by_day(observed, [DAY1, DAY2, DAY3, DAY4])

    assert DAY1 not in resolved
    assert DAY2 not in resolved
    assert resolved[DAY3] == 120.0
    assert resolved[DAY4] == 120.0
    assert gaps == 1


def test_the_series_is_exactly_what_the_ledger_and_the_prices_say(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    for day, close in ((DAY1, 100), (DAY2, 110), (DAY3, 120)):
        _price(db_session, "NPN.JO", day, close)

    result = rebuild_snapshots(db_session, portfolio.id, [
        _txn("NPN.JO", DAY1, "buy", 6),
        _txn("NPN.JO", DAY3, "buy", 4),
    ])
    db_session.commit()

    assert result.days_written == 3
    assert result.first_day == DAY1
    assert _snapshots(db_session, portfolio) == {DAY1: 600.0, DAY2: 660.0, DAY3: 1200.0}


def test_a_book_we_cannot_mostly_price_is_refused_rather_than_drawn(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 100, 10)
    _hold(db_session, portfolio, "GHOST.JO", 900, 10)
    _price(db_session, "NPN.JO", DAY1, 10)

    result = rebuild_snapshots(db_session, portfolio.id, [_txn("NPN.JO", DAY1, "buy", 100)])
    db_session.commit()

    assert result.days_written == 0
    assert result.priced_value_pct < MIN_COVERAGE_PCT
    assert result.unpriced_tickers == ["GHOST.JO"]
    assert _snapshots(db_session, portfolio) == {}


def test_a_small_unpriceable_holding_is_named_but_does_not_stop_the_rebuild(
    db_session, portfolio
):
    _hold(db_session, portfolio, "NPN.JO", 95, 10)
    _hold(db_session, portfolio, "GHOST.JO", 5, 10)
    _price(db_session, "NPN.JO", DAY1, 10)

    result = rebuild_snapshots(db_session, portfolio.id, [_txn("NPN.JO", DAY1, "buy", 95)])
    db_session.commit()

    assert result.days_written == 1
    assert result.priced_value_pct == 95.0
    assert result.unpriced_tickers == ["GHOST.JO"]


def test_the_series_starts_where_every_holding_can_be_priced(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _hold(db_session, portfolio, "SBK.JO", 10, 100)
    for day in (DAY1, DAY2, DAY3):
        _price(db_session, "NPN.JO", day, 100)
    _price(db_session, "SBK.JO", DAY3, 100)

    result = rebuild_snapshots(db_session, portfolio.id, [
        _txn("NPN.JO", DAY1, "buy", 10),
        _txn("SBK.JO", DAY1, "buy", 10),
    ])
    db_session.commit()

    assert result.first_day == DAY3
    assert set(_snapshots(db_session, portfolio)) == {DAY3}


def test_a_day_the_market_was_closed_gets_no_snapshot(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _price(db_session, "NPN.JO", DAY1, 100)
    _price(db_session, "NPN.JO", DAY3, 120)

    rebuild_snapshots(db_session, portfolio.id, [_txn("NPN.JO", DAY1, "buy", 10)])
    db_session.commit()

    written = _snapshots(db_session, portfolio)
    assert set(written) == {DAY1, DAY3}
    assert DAY2 not in written


def test_a_buy_bigger_than_the_position_after_it_is_counted_not_swallowed(
    db_session, portfolio
):
    _hold(db_session, portfolio, "NPN.JO", 5, 100)
    _price(db_session, "NPN.JO", DAY1, 100)
    _price(db_session, "NPN.JO", DAY2, 100)

    result = rebuild_snapshots(db_session, portfolio.id, [
        _txn("NPN.JO", DAY1, "buy", 5),
        _txn("NPN.JO", DAY2, "buy", 20),
    ])
    db_session.commit()

    assert result.ledger_conflicts == 1


def test_a_split_sized_jump_with_no_transaction_is_flagged_and_left_alone(
    db_session, portfolio
):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _price(db_session, "NPN.JO", DAY1, 500)
    _price(db_session, "NPN.JO", DAY2, 100)

    result = rebuild_snapshots(db_session, portfolio.id, [_txn("NPN.JO", DAY1, "buy", 10)])
    db_session.commit()

    assert result.suspect_dates == [DAY2.isoformat()]
    assert _snapshots(db_session, portfolio)[DAY2] == 1000.0


def test_a_jump_with_a_transaction_on_the_same_day_is_not_flagged(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _price(db_session, "NPN.JO", DAY1, 500)
    _price(db_session, "NPN.JO", DAY2, 100)

    result = rebuild_snapshots(db_session, portfolio.id, [
        _txn("NPN.JO", DAY1, "buy", 4),
        _txn("NPN.JO", DAY2, "buy", 6),
    ])
    db_session.commit()

    assert result.suspect_dates == []


def test_a_move_just_under_the_threshold_is_left_alone(db_session, portfolio):
    assert SPLIT_SUSPECT_PCT == 35.0
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _price(db_session, "NPN.JO", DAY1, 100)
    _price(db_session, "NPN.JO", DAY2, 70)

    result = rebuild_snapshots(db_session, portfolio.id, [_txn("NPN.JO", DAY1, "buy", 10)])
    db_session.commit()

    assert result.suspect_dates == []


def test_no_usable_transactions_writes_nothing(db_session, portfolio):
    assert rebuild_snapshots(db_session, portfolio.id, []).days_written == 0
    assert _snapshots(db_session, portfolio) == {}


def test_one_holding_on_one_day_is_rolled_back_like_the_snapshots_are(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)
    _price(db_session, "NPN.JO", DAY2, 110)
    txns = [_txn("NPN.JO", DAY3, "buy", 4), _txn("NPN.JO", DAY4, "sell", 2)]

    assert position_on(db_session, [portfolio.id], "NPN.JO", txns, DAY2) == (8.0, 880.0)
    assert position_on(db_session, [portfolio.id], "NPN.JO", txns, DAY3) == (12.0, None)


def test_a_position_with_no_close_that_day_has_no_value_rather_than_zero(db_session, portfolio):
    _hold(db_session, portfolio, "NPN.JO", 10, 100)

    assert position_on(db_session, [portfolio.id], "NPN.JO", [], DAY1) == (10.0, None)