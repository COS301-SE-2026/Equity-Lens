"""The seeder's cron-facing behaviour: does a failed run show up anywhere.

The seeder itself has been run by hand since it was written, where a traceback on the terminal
is the whole feedback loop. Under cron nobody is watching, so the only two signals left are the
exit code and what lands in the log.
"""
import logging
from datetime import date, timedelta
from unittest.mock import patch

import pandas as pd
import pytest

from app.models.news_event import NewsArticle, NewsFetchLog, NewsIngestRun, PriceAnomaly
from app.repositories.news_repository import NewsRepository
from app.scripts import seed_news
from app.services import news_ingest
from app.services.news_ingest import ProviderResult


@pytest.fixture(autouse=True)
def _restore_log_level():
    level = seed_news.logger.level
    yield
    seed_news.logger.setLevel(level)


@pytest.fixture(autouse=True)
def _no_sleeping():
    # the run pauses between calls and before retries; the tests have no reason to wait
    with patch.object(news_ingest.time, "sleep"):
        yield


def _provider(result):
    return patch.object(news_ingest, "fetch_articles", return_value=result)


def test_a_provider_failure_exits_non_zero(db_session):
    # a failed call covers a missing key, a provider outage and a malformed answer - all mean
    # this run harvested nothing, and a cron that reports success would hide it
    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("provider_error", 503)):
        assert seed_news.main(["NPN.JO"]) == 1


def test_a_run_that_stored_nothing_new_is_still_a_success(db_session):
    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("empty", 200)):
        assert seed_news.main(["NPN.JO"]) == 0


def test_with_no_portfolio_it_still_seeds_the_curated_universe(db_session):
    # a cold install used to seed nothing; now the universe means there is always a corpus to
    # build, so an empty book is a real (successful) run rather than a no-op
    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("empty", 200)) as provider:
        assert seed_news.main([]) == 0
    assert provider.called


def test_quiet_drops_the_per_batch_chatter(db_session, caplog):
    caplog.set_level(logging.DEBUG)

    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("empty", 200)):
        seed_news.main(["--quiet", "NPN.JO"])

    assert [r for r in caplog.records if r.name == "seed_news"] == []


def test_without_quiet_it_says_what_it_did(db_session, caplog):
    caplog.set_level(logging.DEBUG)

    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("empty", 200)):
        seed_news.main(["NPN.JO"])

    assert any("seeded 0 new articles" in r.message for r in caplog.records)


def test_quiet_still_lets_a_failure_through(db_session, caplog):
    # the whole point of the flag is a log that is empty until something is wrong
    caplog.set_level(logging.DEBUG)

    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         _provider(ProviderResult("provider_error", 503)):
        assert seed_news.main(["--quiet", "NPN.JO"]) == 1

    assert any("marketaux call failed" in r.message for r in caplog.records)


def test_the_universe_union_dedupes_and_keeps_holding_format():
    # a held name that is also in the universe appears once; a held-only name survives
    merged = seed_news._merge_universe(["NPN.JO", "ZZZ.JO"])
    assert merged.count("NPN.JO") == 1
    assert "ZZZ.JO" in merged
    assert set(seed_news.SEED_UNIVERSE) <= set(merged)
    # format preserved: upper-cased, and the JSE names keep their .JO suffix
    assert all(t == t.upper() for t in merged)


def test_seed_universe_is_in_holding_ticker_format():
    assert [t.upper() for t in seed_news.SEED_UNIVERSE] == seed_news.SEED_UNIVERSE
    jse = [t for t in seed_news.SEED_UNIVERSE if t.endswith(".JO")]
    assert len(jse) >= 30  # a broad JSE base, not a token few


def _series_with_one_event():
    """70 daily closes: a small wiggle for volatility, then one unmistakable jump on a known day."""
    start = date(2026, 1, 1)
    prices = []
    p = 100.0
    for i in range(70):
        # +/-0.2% each day sits around 1 sigma - never an event on its own, but non-zero variance
        p = p * (1.002 if i % 2 == 0 else 0.998)
        prices.append((start + timedelta(days=i), p))

    event_day = start + timedelta(days=64)  # well past the 30-day seed window
    # lift the level from the event day on: the return INTO that day is the event, the days after
    # are back to the small wiggle around the new level
    jumped = [(d, price * 1.25 if d >= event_day else price) for d, price in prices]
    return jumped, event_day


def test_the_event_is_found_where_the_jump_is():
    series, event_day = _series_with_one_event()

    events = seed_news.detect_events({"NPN.JO": series}, held={"NPN.JO"})

    assert [(e["ticker"], e["date"], e["rejected"]) for e in events] == [
        ("NPN.JO", event_day, None)
    ]
    assert events[0]["held"] is True


def test_a_ticker_with_too_little_history_contributes_no_events():
    # score_series refuses under 60 observations - the backfill must skip it, not raise
    short = [(date(2026, 1, 1) + timedelta(days=i), 100.0 + i) for i in range(10)]
    assert seed_news.detect_events({"AAPL": short}, held=set()) == []


D = date(2026, 7, 1)


def _closes(*prices, step=1):
    return [(D + timedelta(days=i * step), p) for i, p in enumerate(prices)]


def test_a_move_across_a_long_gap_is_rejected_as_a_gap():
    # 6 days since the last close, over MAX_GAP_DAYS = 4
    series = [(D, 100.0), (D + timedelta(days=6), 110.0)]
    assert seed_news.validate_event(series, D + timedelta(days=6)) == "gap"
    # 4 days is the limit itself, and is allowed
    series = [(D, 100.0), (D + timedelta(days=4), 110.0)]
    assert seed_news.validate_event(series, D + timedelta(days=4)) is None
    # nothing before it at all is a gap too
    assert seed_news.validate_event(series, D) == "gap"


@pytest.mark.parametrize(
    ("before", "after", "expected"),
    [
        (100.0, 10000.0, "unit_flip"),   # x100: rands became cents
        (5000.0, 50.0, "unit_flip"),     # /100: cents became rands
        (100.0, 9600.0, "unit_flip"),    # x96: |96/100 - 1| = 0.04, inside 5%
        (100.0, 9400.0, None),           # x94: 0.06, outside 5%, and no next day to reverse
    ],
)
def test_a_factor_of_a_hundred_is_a_unit_flip(before, after, expected):
    assert seed_news.validate_event(_closes(before, after), D + timedelta(days=1)) == expected


@pytest.mark.parametrize(
    ("prices", "expected"),
    [
        # +30% then back to 106: (130 - 106) / (130 - 100) = 24/30 = 0.8, exactly the line
        ((100.0, 130.0, 106.0), "spike"),
        # back to 107 is 23/30 = 0.767 undone, under 0.8, so it stands
        ((100.0, 130.0, 107.0), None),
        # +19% fully undone is still not a spike: under the 20% move it needs to be one
        ((100.0, 119.0, 100.0), None),
        # a -25% fall that bounces back 80%: (75 - 95) / (75 - 100) = -20 / -25 = 0.8
        ((100.0, 75.0, 95.0), "spike"),
    ],
)
def test_a_big_move_undone_the_next_day_is_a_spike(prices, expected):
    assert seed_news.validate_event(_closes(*prices), D + timedelta(days=1)) == expected


def _event(ticker, z, held, day=D, rejected=None):
    return {"ticker": ticker, "date": day, "return_pct": z, "z_score": z, "held": held,
            "rejected": rejected}


def test_held_tickers_come_first_then_the_bigger_move():
    events = [
        _event("AAPL", 6.0, held=False),
        _event("NPN.JO", -3.2, held=True),
        _event("MTN.JO", -5.8, held=True),
    ]

    ordered = [e["ticker"] for e in seed_news.prioritise(events)]

    # held first, ordered by |z|: 5.8 then 3.2. AAPL's 6.0 is the largest but nobody holds it
    assert ordered == ["MTN.JO", "NPN.JO", "AAPL"]


def test_the_plan_stops_at_the_budget_and_never_plans_a_rejected_event(db_session):
    repo = NewsRepository(db_session)
    events = [
        _event("MTN.JO", -5.8, held=True),
        _event("NPN.JO", -3.2, held=True),
        _event("AAPL", 6.0, held=False),
        _event("SBK.JO", 9.0, held=True, rejected="spike"),
    ]

    planned, skipped = seed_news.plan_calls(repo, events, budget=2, today=D)

    assert [e["ticker"] for e, _ in planned] == ["MTN.JO", "NPN.JO"]
    assert skipped == {"older_than_window": 0, "already_fetched": 0, "over_budget": 1}
    # the window is event - 4 days to event + 2 days, which covers [-3, +1] in local dates
    call = planned[0][1]
    assert (call.published_after, call.published_before) == ("2026-06-27", "2026-07-03")
    assert call.countries == "za"
    assert call.scope == "backfill:MTN.JO:2026-07-01"


def test_a_window_already_in_the_ledger_is_not_asked_for_again(db_session):
    repo = NewsRepository(db_session)
    repo.record_fetch("backfill:MTN.JO:2026-07-01", "marketaux", 0, ok=True)
    db_session.commit()

    planned, skipped = seed_news.plan_calls(repo, [_event("MTN.JO", -5.8, held=True)], budget=5,
                                            today=D)

    assert planned == []
    assert skipped["already_fetched"] == 1


def _history(series):
    days, closes = zip(*series, strict=True)
    return pd.DataFrame({"Close": list(closes)}, index=pd.to_datetime(list(days)))


def _backfill(db_session, mode, provider_result=None):
    series, event_day = _series_with_one_event()
    known = ProviderResult("ok", 200, [{"symbol": "NPN.JO"}])
    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         patch.object(seed_news, "get_cached_price_histories",
                      return_value={"NPN.JO": _history(series)}), \
         patch.object(news_ingest, "search_entities", return_value=known) as search, \
         patch.object(news_ingest, "fetch_articles",
                      return_value=provider_result or ProviderResult("empty", 200)) as provider:
        # "today" is the event day, so the move sits inside the six-month window
        ok = seed_news.backfill_event_windows(["NPN.JO"], mode=mode, budget=10, today=event_day)
    return ok, event_day, provider, search


def _article_on(day):
    return {
        "uuid": "a", "title": "Naspers shares jump", "source": "Example",
        "published_at": f"{day.isoformat()}T08:00:00Z",
        "entities": [{"symbol": "NPN.JO", "name": "Naspers Limited", "country": "za",
                      "type": "equity", "match_score": 40.0}],
    }


def test_plan_mode_makes_no_news_calls_and_records_a_planned_run(db_session):
    ok, _, provider, search = _backfill(db_session, "plan")

    assert ok is True
    provider.assert_not_called()
    # the universe check is one entity search, and it is in the ledger like any other call
    assert search.call_count == 1
    assert db_session.query(NewsFetchLog).count() == 1
    assert db_session.query(NewsIngestRun).one().status == "planned"
    # a plan writes nothing, the register included
    assert db_session.query(PriceAnomaly).count() == 0


def test_a_dry_run_calls_the_provider_but_stores_no_article(db_session):
    _, event_day = _series_with_one_event()
    ok, _, provider, _ = _backfill(
        db_session, "dry_run", ProviderResult("ok", 200, [_article_on(event_day)])
    )

    assert ok is True
    assert provider.call_count == 1
    assert db_session.query(NewsArticle).count() == 0
    assert db_session.query(NewsIngestRun).one().status == "dry_run"
    # the call is real and counts against the day, but it must not mark the window done
    scope = db_session.query(NewsFetchLog).one().scope
    assert scope == f"dry_run:NPN.JO:{event_day.isoformat()}"
    # the register costs no quota, so a dry run keeps it too
    row = db_session.query(PriceAnomaly).one()
    assert (row.ticker, row.event_date, row.validation) == ("NPN.JO", event_day, "ok")


def test_a_real_run_stores_the_article_as_a_backfill_and_writes_the_report(db_session, tmp_path):
    series, event_day = _series_with_one_event()
    report = tmp_path / "review.md"
    with patch.object(seed_news, "SessionLocal", return_value=db_session), \
         patch.object(seed_news, "get_cached_price_histories",
                      return_value={"NPN.JO": _history(series)}), \
         patch.object(news_ingest, "fetch_articles",
                      return_value=ProviderResult("ok", 200, [_article_on(event_day)])):
        assert seed_news.backfill_event_windows(["NPN.JO"], budget=10, report=str(report),
                                                today=event_day)

    stored = db_session.query(NewsArticle).one()
    assert stored.ingest_mode == "backfill"
    run = db_session.query(NewsIngestRun).one()
    assert stored.first_ingest_run_id == run.id
    assert run.events_with_candidates == 1

    text = report.read_text()
    assert "not established causes" in text
    # the article is on the event day itself, in Johannesburg's calendar
    assert f"| NPN.JO | {event_day} |" in text
    assert "Naspers shares jump" in text
    assert "(+0d)" in text
    assert "headline names it" in text
    # one validated move in the window, and its article counts: 1 of 1 = 100.0%
    assert "1 of 1 (100.0%)" in text


TODAY = date(2026, 9, 24)


def test_a_move_older_than_the_window_is_detected_but_not_planned(db_session):
    # 24 Sep less 200 days is 8 Mar. the window starts 24 Sep less 183 days = 25 Mar
    old = _event("MTN.JO", -5.8, held=True, day=date(2026, 3, 8))

    planned, skipped = seed_news.plan_calls(NewsRepository(db_session), [old], budget=5,
                                            today=TODAY)

    assert planned == []
    assert skipped == {"older_than_window": 1, "already_fetched": 0, "over_budget": 0}


def test_a_move_inside_the_window_is_planned(db_session):
    # 24 Sep less 150 days is 27 Apr, after 25 Mar
    recent = _event("MTN.JO", -5.8, held=True, day=date(2026, 4, 27))

    planned, skipped = seed_news.plan_calls(NewsRepository(db_session), [recent], budget=5,
                                            today=TODAY)

    assert [e["date"] for e, _ in planned] == [date(2026, 4, 27)]
    assert skipped["older_than_window"] == 0


def test_the_window_includes_its_first_day(db_session):
    # exactly 183 days back is 25 Mar, the first day of the window, so it is planned. one day
    # more (24 Mar) is not
    edge = _event("MTN.JO", -5.8, held=True, day=date(2026, 3, 25))
    outside = _event("NPN.JO", -4.1, held=True, day=date(2026, 3, 24))

    planned, skipped = seed_news.plan_calls(NewsRepository(db_session), [edge, outside],
                                            budget=5, today=TODAY)

    assert [e["ticker"] for e, _ in planned] == ["MTN.JO"]
    assert skipped["older_than_window"] == 1


def test_an_old_move_never_takes_a_call_from_a_recent_one(db_session):
    # the old move has the bigger |z| (6.0 against 3.5), so with the filter after the budget
    # it would have taken the only call
    old = _event("MTN.JO", -6.0, held=True, day=date(2026, 3, 8))
    recent = _event("NPN.JO", -3.5, held=True, day=date(2026, 9, 1))

    planned, skipped = seed_news.plan_calls(NewsRepository(db_session), [old, recent], budget=1,
                                            today=TODAY)

    assert [e["ticker"] for e, _ in planned] == ["NPN.JO"]
    assert skipped == {"older_than_window": 1, "already_fetched": 0, "over_budget": 0}


def test_since_days_has_to_be_positive():
    with pytest.raises(SystemExit):
        seed_news.main(["--event-windows", "--plan", "--since-days", "0"])


def _move(ticker, day, direction="down", band="unusual", rejected=None):
    return {"ticker": ticker, "date": day, "direction": direction, "band": band,
            "rejected": rejected}


def _twelve_moves():
    """12 validated moves in the window (6 MTN.JO, 6 SBK.JO), 2 rejected, 1 too old."""
    mtn = [_move("MTN.JO", date(2026, 5, d)) for d in range(1, 7)]
    sbk = [_move("SBK.JO", date(2026, 6, d), direction="up", band="very_unusual")
           for d in range(1, 7)]
    bad = [_move("MTN.JO", date(2026, 7, 1), rejected="spike"),
           _move("SBK.JO", date(2026, 7, 2), rejected="unit_flip")]
    old = [_move("MTN.JO", date(2026, 1, 5))]
    return mtn + sbk + bad + old


def test_the_coverage_headline_is_the_share_of_validated_moves_with_news():
    events = _twelve_moves()
    # three MTN.JO moves have an article that counts; SBK.JO has none
    evidence = {("MTN.JO", date(2026, 5, d)) for d in (1, 2, 3)}
    # every MTN.JO window was fetched, two of SBK.JO's
    fetched = {("MTN.JO", date(2026, 5, d)) for d in range(1, 7)} | {
        ("SBK.JO", date(2026, 6, d)) for d in (1, 2)}

    summary = seed_news.coverage_summary(events, date(2026, 3, 25), fetched, evidence)

    # in the window: 12 validated + 2 rejected = 14. the January move is before 25 Mar
    assert summary["detected"] == 14
    # down: 6 MTN.JO + 2 rejected = 8. up: 6 SBK.JO
    assert (summary["down"], summary["up"]) == (8, 6)
    assert summary["bands"] == {"unusual": 8, "very_unusual": 6}
    assert summary["validated"] == 12
    assert summary["rejected"] == {"spike": 1, "unit_flip": 1}
    # 6 + 2 = 8 windows fetched
    assert summary["fetched"] == 8
    # 3 / 12 = 0.25 -> 25.0%
    assert summary["with_evidence"] == 3
    assert summary["evidence_pct"] == 25.0
    # per ticker: MTN.JO 3 / 6 = 50.0%, SBK.JO 0 / 6 = 0.0%. the rejected spike still counts as
    # detected for MTN.JO: 6 + 1 = 7
    assert summary["per_ticker"]["MTN.JO"] == {
        "detected": 7, "validated": 6, "fetched": 6, "with_evidence": 3, "evidence_pct": 50.0,
    }
    assert summary["per_ticker"]["SBK.JO"]["evidence_pct"] == 0.0


def test_a_move_on_the_first_day_of_the_window_is_in_the_summary():
    # 25 Mar is the window start itself
    summary = seed_news.coverage_summary([_move("MTN.JO", date(2026, 3, 25))],
                                         date(2026, 3, 25), set(), set())

    assert summary["validated"] == 1


def test_with_no_validated_moves_there_is_no_percentage_to_give():
    # 0 of 0 is not 0%: there was nothing to find news for
    summary = seed_news.coverage_summary([_move("MTN.JO", date(2026, 5, 1), rejected="gap")],
                                         date(2026, 3, 25), set(), set())

    assert summary["validated"] == 0
    assert summary["evidence_pct"] is None
    assert summary["per_ticker"]["MTN.JO"]["evidence_pct"] is None


def test_the_report_opens_with_the_coverage_summary(tmp_path):
    events = [{**e, "return_pct": -4.0, "z_score": -3.5, "held": True} for e in _twelve_moves()]
    evidence = {("MTN.JO", date(2026, 5, d)) for d in (1, 2, 3)}
    summary = seed_news.coverage_summary(events, date(2026, 3, 25), set(), evidence)
    report = tmp_path / "review.md"

    seed_news.write_report(str(report), events, {}, summary)

    text = report.read_text()
    assert "## Coverage since 2026-03-25" in text
    assert "Anomalies detected: 14 (6 up, 8 down)" in text
    assert "Rejected as bad data: 2 (spike 1, unit_flip 1)" in text
    assert "3 of 12 (25.0%)" in text
    assert "| MTN.JO | 7 | 6 | 0 | 3 | 50.0 |" in text
    # the summary comes before the per-event table
    assert text.index("## Coverage") < text.index("| Ticker | Event date |")


def test_detection_keeps_what_the_register_needs():
    series, _ = _series_with_one_event()
    scanned = {}

    event = seed_news.detect_events({"NPN.JO": series}, held=set(), scanned=scanned)[0]

    assert (event["direction"], event["k_sigma"]) == ("up", 3.0)
    assert event["band"] is not None
    assert event["sigma"] > 0
    # closes on days 0..69 give returns on days 1..69. the first 30 (days 1..30) seed the
    # variance, so the first scored return is day 31 (1 Feb) and the last is day 69 (11 Mar)
    assert scanned == {"NPN.JO": [
        (date(2026, 1, 1) + timedelta(days=31)).isoformat(),
        (date(2026, 1, 1) + timedelta(days=69)).isoformat(),
    ]}

