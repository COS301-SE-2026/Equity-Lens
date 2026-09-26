"""The nightly job's own decisions: what it asks for first, from when, and how it exits.

The provider and the price fetch are stubbed throughout. Nothing here reaches marketaux or Yahoo.
"""
import json
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pandas as pd
import pytest
from sqlalchemy.orm import sessionmaker

from app.models.news_event import NewsIngestRun
from app.repositories.news_repository import NewsRepository
from app.scripts import news_nightly
from app.scripts.seed_news import detect_events
from app.services.market_data_service import get_current_price
from app.utils import stock_cache

NOW = datetime(2026, 9, 25, 0, 30, tzinfo=UTC)


def test_held_tickers_are_asked_for_before_the_rest_one_country_per_call():
    ordered = ["MTN.JO", "AAPL", "SBK.JO", "NPN.JO", "MSFT"]
    held = {"MTN.JO", "AAPL"}

    calls = news_nightly.latest_news_calls(ordered, held, NOW, dry_run=False)

    assert [(c.symbols, c.countries) for c in calls] == [
        (["MTN.JO"], "za"),
        (["AAPL"], "us"),
        (["SBK.JO", "NPN.JO"], "za"),
        (["MSFT"], "us"),
    ]
    assert calls[0].scope == "nightly:MTN.JO"
    # the cursor goes out in marketaux's Y-m-d\TH:i:s form, in UTC
    assert calls[0].published_after == "2026-09-25T00:30:00"


def test_a_batch_holds_five_symbols_and_the_sixth_starts_another():
    held = [f"T{i}.JO" for i in range(6)]

    calls = news_nightly.latest_news_calls(held, set(held), NOW, dry_run=True)

    assert [len(c.symbols) for c in calls] == [5, 1]
    # a dry run's calls are marked so the ledger never mistakes them for a real run's
    assert all(c.scope.startswith("dry_run:nightly:") for c in calls)


def _run(db_session, mode, status, started):
    db_session.add(NewsIngestRun(mode=mode, status=status, started_at=started))
    db_session.commit()


def test_the_cursor_is_the_start_of_the_last_nightly_run_that_got_anything(db_session):
    repo = NewsRepository(db_session)
    good = NOW - timedelta(days=1)
    _run(db_session, "nightly", "partial", good)
    # later, but none of these collected anything a nightly run can count on
    _run(db_session, "nightly", "failed", NOW - timedelta(hours=2))
    _run(db_session, "nightly", "dry_run", NOW - timedelta(hours=1))
    _run(db_session, "backfill", "ok", NOW - timedelta(minutes=30))

    assert news_nightly.news_cursor(repo, NOW) == good


def test_with_no_good_run_the_cursor_is_thirty_six_hours_back(db_session):
    # 00:30 on the 25th less 36 hours is 12:30 on the 23rd
    assert news_nightly.news_cursor(NewsRepository(db_session), NOW) == datetime(
        2026, 9, 23, 12, 30, tzinfo=UTC
    )


def _event(ticker="MTN.JO", day=date(2026, 7, 31)):
    return {"ticker": ticker, "date": day, "return_pct": -10.8, "z_score": -5.8,
            "held": True, "rejected": None}


def _link(db_session, match_score, published):
    NewsRepository(db_session).upsert_articles([{
        "external_id": f"a{match_score}", "source": "marketaux", "title": "Telecoms fall",
        "published_at": published, "tickers": [{"ticker": "MTN.JO", "match_score": match_score}],
    }])
    db_session.commit()


def test_an_event_with_an_article_already_on_the_card_is_not_asked_for_again(db_session):
    repo = NewsRepository(db_session)
    # 40 is over the 25 threshold and the article is on the event day, so it already counts
    _link(db_session, 40.0, datetime(2026, 7, 31, 8, 0, tzinfo=UTC))

    assert news_nightly.uncovered(repo, [_event()], {"MTN.JO": "MTN Group"}) == []


def test_a_weak_or_out_of_window_article_does_not_cover_an_event(db_session):
    repo = NewsRepository(db_session)
    # 12.6 is under 25 and "telecoms fall" does not name MTN, so it is not evidence
    _link(db_session, 12.6, datetime(2026, 7, 31, 8, 0, tzinfo=UTC))
    # 40 but on the 26th, day -5, outside [-3, +1]
    _link(db_session, 40.0, datetime(2026, 7, 26, 8, 0, tzinfo=UTC))

    assert news_nightly.uncovered(repo, [_event()], {"MTN.JO": "MTN Group"}) == [_event()]


def _jump_on(jump_day):
    """70 closes wiggling +/-0.2% a day, lifted 25% from jump_day on."""
    start, closes, p = date(2026, 1, 1), [], 100.0
    for i in range(70):
        p *= 1.002 if i % 2 == 0 else 0.998
        closes.append((start + timedelta(days=i), p * (1.25 if i >= jump_day else 1.0)))
    return closes


def test_only_moves_from_the_last_seven_trading_days_are_recent():
    # of 70 closes the last 7 are days 63..69, so a jump on day 63 is recent
    closes = {"MTN.JO": _jump_on(63)}
    recent = news_nightly.recent_events(detect_events(closes, {"MTN.JO"}), closes)
    assert [e["date"] for e in recent] == [date(2026, 1, 1) + timedelta(days=63)]
    # day 62 is the 8th from the end, and is left to the backfill
    closes = {"MTN.JO": _jump_on(62)}
    assert news_nightly.recent_events(detect_events(closes, {"MTN.JO"}), closes) == []


@pytest.mark.parametrize(
    ("status", "code"),
    [("ok", 0), ("dry_run", 0), ("planned", 0), ("skipped", 0), ("partial", 1), ("failed", 2)],
)
def test_the_exit_code_follows_the_run_status(status, code, capsys):
    with patch.object(news_nightly, "nightly", return_value={"status": status}):
        assert news_nightly.main(["--quiet"]) == code

    # and the one line on stdout is json the workflow can read
    assert json.loads(capsys.readouterr().out.strip().splitlines()[-1]) == {"status": status}


def test_a_second_run_backs_off_without_writing_anything(db_session, capsys):
    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "try_lock", return_value=False), \
         patch.object(news_nightly, "refresh_prices") as prices:
        code = news_nightly.main([])

    assert code == 0
    prices.assert_not_called()
    assert db_session.query(NewsIngestRun).count() == 0
    assert json.loads(capsys.readouterr().out.strip())["reason"] == "another run in progress"


def test_the_lock_is_a_no_op_on_sqlite(db_session):
    with db_session.get_bind().connect() as conn:
        assert news_nightly.try_lock(conn) is True


def test_the_price_refresh_is_what_feeds_the_next_mornings_today_figure(db_engine, db_session):
    # yfinance is stubbed with two closes for NPN.JO, in cents as the cache stores them:
    # 10000 then 10300. the refresh writes both, with Prev Close shifted from the first, so
    # the dashboard's daily change is (103 - 100) / 100 = 3.0%
    frame = pd.DataFrame(
        {"Open": [10000.0, 10300.0], "High": [10000.0, 10300.0], "Low": [10000.0, 10300.0],
         "Close": [10000.0, 10300.0], "Volume": [1.0, 1.0]},
        index=pd.to_datetime([date.today() - timedelta(days=1), date.today()]),
    )
    local = sessionmaker(bind=db_engine)
    with patch.object(stock_cache, "SessionLocal", local), \
         patch.object(stock_cache.yf, "download", return_value=frame), \
         patch.object(stock_cache.settings, "alpha_vantage_api_key", None):
        closes, failed = news_nightly.refresh_prices(db_session, ["NPN.JO"])
        change = get_current_price("NPN.JO", db_session).change_percent

    assert failed == []
    assert [c for _, c in closes["NPN.JO"]] == [10000.0, 10300.0]
    assert change == pytest.approx(3.0)


def test_anything_that_escapes_the_run_is_a_failure_not_a_partial(capsys):
    # a python traceback exits 1, which the workflow would read as "partial" and pass
    with patch.object(news_nightly, "nightly", side_effect=RuntimeError("no news tables")):
        assert news_nightly.main(["--quiet"]) == 2

    summary = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert summary == {"status": "failed", "error": "RuntimeError: no news tables"}
