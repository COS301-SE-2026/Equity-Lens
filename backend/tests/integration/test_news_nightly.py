"""The whole nightly job, end to end, against the test database with the provider stubbed.

Every article comes from the marketaux fixtures (recorded where they exist, the synthetic
stand-ins where they do not), trimmed to the one entity each case is about so the counters can
be worked out by hand. No network, no quota.
"""
import copy
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from app.models.news_event import (
    NewsArticle,
    NewsArticleTicker,
    NewsFetchLog,
    NewsIngestRun,
    PriceAnomaly,
)
from app.models.portfolio import Holdings, Portfolios
from app.repositories.news_repository import NewsRepository
from app.scripts import news_nightly, seed_news
from app.services import news_ingest
from app.services.news_ingest import ProviderResult

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "marketaux"
START = date(2026, 5, 1)
JUMP = 65
EVENT_DAY = START + timedelta(days=JUMP)


def payload(name):
    recorded = FIXTURES / f"{name}.json"
    if recorded.exists() and json.loads(recorded.read_text()).get("data"):
        return json.loads(recorded.read_text())
    return json.loads((FIXTURES / f"{name}_synthetic.json").read_text())


def with_only(name, **match):
    """The first fixture article carrying a matching entity, with just that entity kept."""
    for article in payload(name)["data"]:
        for entity in article.get("entities", []):
            if all(entity.get(k) == v for k, v in match.items()):
                return {**copy.deepcopy(article), "entities": [entity]}
    raise AssertionError(f"{name} has no entity matching {match}")


def closes_with_a_recent_jump():
    # 70 days wiggling +/-0.2%, lifted 25% on day 65 - inside the last 7 trading days, and it
    # stays up, so it is a real move and not a spike
    rows, p = [], 100.0
    for i in range(70):
        p *= 1.002 if i % 2 == 0 else 0.998
        rows.append((START + timedelta(days=i), p * (1.25 if i >= JUMP else 1.0)))
    days, closes = zip(*rows, strict=True)
    return pd.DataFrame({"Close": list(closes)}, index=pd.to_datetime(list(days)))


@pytest.fixture
def holds_mtn(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-N", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="MTN Group", ticker="MTN.JO",
        sector="Telecommunications", quantity=10, cost_price=100, total_cost=1000,
    ))
    db_session.commit()


@pytest.mark.usefixtures("holds_mtn")
def test_one_night_with_a_429_a_malformed_article_vail_a_duplicate_and_an_event(
    db_session, monkeypatch, capsys
):
    # the universe is MTN.JO (held) plus SBK.JO and AAPL, so the latest-news batches are
    # MTN.JO, then SBK.JO, then AAPL, and the jump adds one event window for MTN.JO
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", ["SBK.JO", "AAPL"])

    vail = with_only("vail_mtn_collision", symbol="MTN")
    mtn = with_only("jse_mtn_sbk_latest", symbol="MTN.JO")
    sbk = with_only("jse_mtn_sbk_latest", symbol="SBK.JO")
    malformed = {**copy.deepcopy(sbk), "uuid": "no-title", "title": ""}
    on_the_day = {**copy.deepcopy(mtn), "uuid": "event-day",
                  "published_at": f"{EVENT_DAY.isoformat()}T08:00:00Z"}

    # the MTN.JO article is already stored from an earlier run
    NewsRepository(db_session).upsert_articles(
        [news_ingest.normalise_article(mtn, {"MTN.JO"})], ingest_mode="on_demand"
    )
    db_session.commit()

    answers = {
        "nightly:MTN.JO": [ProviderResult("rate_limited", 429),
                           ProviderResult("ok", 200, [vail, mtn])],
        "nightly:SBK.JO": [ProviderResult("ok", 200, [sbk, malformed])],
        "nightly:AAPL": [ProviderResult("empty", 200)],
        f"backfill:MTN.JO:{EVENT_DAY.isoformat()}": [ProviderResult("ok", 200, [on_the_day])],
    }
    calls = []

    # called as fetch_articles(symbols, timeout, after, before, countries)
    def provider(symbols, _timeout, _after, published_before, _countries):
        scope = (f"backfill:{symbols[0]}:{EVENT_DAY.isoformat()}" if published_before
                 else f"nightly:{','.join(symbols)}")
        calls.append(scope)
        return answers[scope].pop(0)

    histories = {"MTN.JO": closes_with_a_recent_jump()}
    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "get_cached_price_histories", return_value=histories), \
         patch.object(news_ingest, "fetch_articles", side_effect=provider), \
         patch.object(news_ingest.time, "sleep"):
        code = news_nightly.main([])

    summary = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    run = db_session.query(NewsIngestRun).one()

    assert code == 0
    assert summary["status"] == run.status == "ok"
    assert calls == ["nightly:MTN.JO", "nightly:MTN.JO", "nightly:SBK.JO", "nightly:AAPL",
                     f"backfill:MTN.JO:{EVENT_DAY.isoformat()}"]

    # 5 calls: MTN.JO twice (the 429 and its retry), SBK.JO, AAPL, the event window
    assert run.requests_made == 5
    assert db_session.query(NewsFetchLog).count() == 5
    # received: 2 (vail, mtn) + 2 (sbk, malformed) + 0 + 1 (on the day) = 5
    assert run.articles_received == 5
    assert run.articles_malformed == 1
    # new: vail (stored for the corpus, unlinked), sbk, on the day = 3. mtn was already there
    assert run.articles_new == 3
    assert run.articles_duplicate == 1
    # links: SBK.JO on sbk, MTN.JO on the event-day article = 2. mtn's link already existed
    assert run.links_new == 2
    # rejected: the one Vail entity, symbol MTN, which is not MTN.JO
    assert run.links_rejected == 1
    assert run.events_considered == 1
    assert run.events_with_candidates == 1
    assert summary["articles_new"] == 3

    vail_row = db_session.query(NewsArticle).filter_by(external_id=vail["uuid"]).one()
    assert vail_row.tickers == []
    assert db_session.query(NewsArticle).filter_by(external_id=mtn["uuid"]).count() == 1
    stored_link = (db_session.query(NewsArticleTicker)
                   .join(NewsArticle).filter(NewsArticle.external_id == "event-day").one())
    assert stored_link.ticker == "MTN.JO"
    assert db_session.query(NewsArticle).filter_by(external_id="event-day").one().ingest_mode \
        == "nightly"


@pytest.mark.usefixtures("holds_mtn")
def test_a_night_that_hits_the_usage_limit_is_partial_and_exits_one(
    db_session, monkeypatch, capsys
):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", ["SBK.JO"])
    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "get_cached_price_histories", return_value={}), \
         patch.object(news_ingest, "fetch_articles",
                      return_value=ProviderResult("quota_exhausted", 402)) as provider, \
         patch.object(news_ingest.time, "sleep"):
        code = news_nightly.main(["--quiet"])

    assert code == 1
    # the 402 stops everything: one call, and the SBK.JO batch is never asked for
    assert provider.call_count == 1
    assert json.loads(capsys.readouterr().out.strip())["status"] == "partial"


@pytest.mark.usefixtures("holds_mtn")
def test_a_refused_key_fails_the_night_and_exits_two(db_session, monkeypatch):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", [])
    refused = ProviderResult("auth_error", 401)
    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "get_cached_price_histories", return_value={}), \
         patch.object(news_ingest, "fetch_articles", return_value=refused), \
         patch.object(news_ingest.time, "sleep"):
        assert news_nightly.main(["--quiet"]) == 2
    assert db_session.query(NewsIngestRun).one().status == "failed"


@pytest.mark.usefixtures("holds_mtn")
def test_plan_mode_spends_nothing(db_session, monkeypatch):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", ["SBK.JO"])
    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "get_cached_price_histories",
                      return_value={"MTN.JO": closes_with_a_recent_jump()}), \
         patch.object(news_ingest, "fetch_articles") as provider:
        assert news_nightly.main(["--plan"]) == 0

    provider.assert_not_called()
    assert db_session.query(NewsFetchLog).count() == 0
    assert db_session.query(NewsIngestRun).one().status == "planned"
    assert db_session.query(PriceAnomaly).count() == 0


@pytest.mark.usefixtures("holds_mtn")
def test_the_event_card_says_when_news_was_last_collected(client, auth_headers, db_session):
    finished = datetime(2026, 9, 25, 0, 41, 12, tzinfo=UTC)
    db_session.add(NewsIngestRun(mode="nightly", status="ok", started_at=finished,
                                 finished_at=finished))
    # a later failed night is the status shown, next to the date of the last good one
    db_session.add(NewsIngestRun(mode="nightly", status="failed",
                                 started_at=finished + timedelta(days=1),
                                 finished_at=finished + timedelta(days=1)))
    # a dry run collected nothing, so it moves neither
    db_session.add(NewsIngestRun(mode="nightly", status="dry_run",
                                 started_at=finished + timedelta(days=2),
                                 finished_at=finished + timedelta(days=2)))
    db_session.commit()

    with patch("app.services.portfolio_service.closes_for_tickers", return_value={}):
        coverage = client.get("/api/portfolio/events", headers=auth_headers).json()["coverage"]

    assert coverage["news_last_collected_at"] == "2026-09-25T00:41:12Z"
    assert coverage["news_last_run_status"] == "failed"


def ending_today(jump_at=None, size=1.25):
    """100 daily closes up to today, wiggling +/-0.2%, lifted by `size` from index jump_at on.
    the last 7 closes (index 93 to 99) are the nightly's own week; anything earlier is left to
    the catch-up."""
    start = date.today() - timedelta(days=99)
    rows, p = [], 100.0
    for i in range(100):
        p *= 1.002 if i % 2 == 0 else 0.998
        lifted = jump_at is not None and i >= jump_at
        rows.append((start + timedelta(days=i), p * (size if lifted else 1.0)))
    days, closes = zip(*rows, strict=True)
    return pd.DataFrame({"Close": list(closes)}, index=pd.to_datetime(list(days)))


def _night(db_session, histories, budget):
    calls = []

    # called as fetch_articles(symbols, timeout, after, before, countries)
    def provider(symbols, _timeout, published_after, published_before, _countries):
        calls.append((symbols, published_after, published_before))
        return ProviderResult("empty", 200)

    with patch.object(news_nightly, "SessionLocal", return_value=db_session), \
         patch.object(news_nightly, "get_cached_price_histories", return_value=histories), \
         patch.object(news_nightly.settings, "news_nightly_request_budget", budget), \
         patch.object(news_ingest, "fetch_articles", side_effect=provider), \
         patch.object(news_ingest.time, "sleep"):
        summary = news_nightly.nightly()
    return summary, calls


@pytest.mark.usefixtures("holds_mtn")
def test_what_the_night_does_not_spend_goes_on_the_backlog(db_session, monkeypatch):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", [
        "SBK.JO", "NPN.JO", "AGL.JO", "FSR.JO", "SOL.JO", "ABG.JO", "NED.JO", "AAPL",
    ])
    # MTN.JO and SBK.JO moved this week; six others moved 39 days ago; AAPL did nothing
    histories = {t: ending_today(96) for t in ("MTN.JO", "SBK.JO")}
    histories |= {t: ending_today(60) for t in ("NPN.JO", "AGL.JO", "FSR.JO", "SOL.JO",
                                                "ABG.JO", "NED.JO")}
    histories["AAPL"] = ending_today()

    summary, calls = _night(db_session, histories, budget=10)

    # latest news: MTN.JO (held), then the other seven JSE names in batches of five (2 calls),
    # then AAPL = 4. the two moves this week = 2 more. 4 + 2 = 6 of 10, leaving 4 for the
    # backlog of 6, so 4 run and 6 - 4 = 2 remain
    assert summary["requests_made"] == 10
    assert summary["catchup_windows"] == 4
    assert summary["catchup_remaining"] == 2
    backlog = calls[6:]
    assert len(backlog) == 4
    # index 60 of 100 closes ending today is 39 days back; its window opens 4 days earlier
    assert all(after == (date.today() - timedelta(days=43)).isoformat()
               for _, after, _ in backlog)

    # the register holds every move the detector found: 2 this week + 6 older = 8, and the
    # run says what it scanned: all 9 tickers had enough history
    assert db_session.query(PriceAnomaly).count() == 8
    run = db_session.query(NewsIngestRun).one()
    assert len(json.loads(run.details)["scanned"]) == 9
    # the backlog is stored as backfill, the same as a hand-run seed
    assert db_session.query(NewsFetchLog).filter(
        NewsFetchLog.scope.like("backfill:%")).count() == 6


@pytest.mark.usefixtures("holds_mtn")
def test_with_nothing_left_to_fill_the_catch_up_runs_nothing(db_session, monkeypatch):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", [])
    # only this week's move, and it gets its window from the recent pass
    summary, calls = _night(db_session, {"MTN.JO": ending_today(96)}, budget=10)

    # 1 latest call + 1 recent window = 2, and nothing older to do
    assert len(calls) == 2
    assert summary["catchup_windows"] == 0
    assert summary["catchup_remaining"] == 0


@pytest.mark.usefixtures("holds_mtn")
def test_the_backlog_does_a_held_ticker_first(db_session, monkeypatch):
    monkeypatch.setattr(seed_news, "SEED_UNIVERSE", ["AAPL"])
    # AAPL's 40% jump is the bigger move, but MTN.JO's 25% is held
    histories = {"MTN.JO": ending_today(60), "AAPL": ending_today(60, size=1.40)}

    summary, calls = _night(db_session, histories, budget=3)

    # 2 latest calls (MTN.JO, AAPL), leaving 1 of 3 for the backlog of 2
    assert [c[0] for c in calls] == [["MTN.JO"], ["AAPL"], ["MTN.JO"]]
    assert (summary["catchup_windows"], summary["catchup_remaining"]) == (1, 1)

