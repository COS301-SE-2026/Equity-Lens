from datetime import UTC, date, datetime, timedelta

import pytest

from app.models.news_event import NewsArticle, NewsFetchLog, NewsIngestRun, PriceAnomaly
from app.repositories.news_repository import NewsRepository

NOW = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)

def row(external_id, title, published=NOW, description=None, tickers=("NPN.JO",)):
    return {
        "external_id": external_id,
        "source": "marketaux",
        "title": title,
        "description": description,
        "url": f"https://example.com/{external_id}",
        "image_url": None,
        "source_name": "Example",
        "published_at": published,
        "sentiment": "positive",
        "sentiment_score": 0.4,
        "tickers": [{"ticker": t, "sentiment_score": 0.4, "match_score": 40.0} for t in tickers],
    }

@pytest.fixture
def repo(db_session):
    return NewsRepository(db_session)

def test_the_same_article_twice_is_stored_once(repo, db_session):
    assert repo.upsert_articles([row("a", "Naspers profit rises")]) == (1, 1)
    db_session.commit()
    assert repo.upsert_articles([row("a", "Naspers profit rises")]) == (0, 0)
    db_session.commit()
    assert db_session.query(NewsArticle).count() == 1

def test_a_second_upsert_does_not_duplicate_the_ticker_links(repo, db_session):
    repo.upsert_articles([row("a", "Naspers profit rises", tickers=("NPN.JO", "PRX.JO"))])
    db_session.commit()
    repo.upsert_articles([row("a", "Naspers profit rises", tickers=("NPN.JO", "PRX.JO"))])
    db_session.commit()
    stored = db_session.query(NewsArticle).one()
    assert sorted(link.ticker for link in stored.tickers) == ["NPN.JO", "PRX.JO"]

def test_a_ticker_link_is_added_to_an_article_already_stored(repo, db_session):
    repo.upsert_articles([row("a", "Naspers and Prosus", tickers=("NPN.JO",))])
    db_session.commit()
    repo.upsert_articles([row("a", "Naspers and Prosus", tickers=("NPN.JO", "PRX.JO"))])
    db_session.commit()
    stored = db_session.query(NewsArticle).one()
    assert sorted(link.ticker for link in stored.tickers) == ["NPN.JO", "PRX.JO"]

def test_articles_come_back_newest_first_and_only_for_the_tickers_asked_for(repo, db_session):
    repo.upsert_articles([
        row("old", "Older Naspers story", NOW - timedelta(days=2)),
        row("new", "Newer Naspers story", NOW),
        row("other", "Standard Bank story", NOW, tickers=("SBK.JO",)),
    ])
    db_session.commit()
    found = repo.articles_for_tickers(["NPN.JO"])
    assert [a.external_id for a in found] == ["new", "old"]

def test_the_ticker_lookup_is_case_insensitive(repo, db_session):
    repo.upsert_articles([row("a", "Naspers profit rises", tickers=("npn.jo",))])
    db_session.commit()
    assert len(repo.articles_for_tickers(["NPN.JO"])) == 1

def test_the_window_query_excludes_articles_on_either_side_of_it(repo, db_session):
    repo.upsert_articles([
        row("before", "Too early", NOW - timedelta(days=10)),
        row("inside", "Just right", NOW - timedelta(days=1)),
        row("after", "Too late", NOW + timedelta(days=10)),
    ])
    db_session.commit()
    found = repo.articles_in_window(
        "NPN.JO", NOW - timedelta(days=3), NOW + timedelta(days=1)
    )
    assert [a.external_id for a in found] == ["inside"]

def test_the_corpus_joins_the_title_and_description_and_respects_its_cap(repo, db_session):
    repo.upsert_articles([
        row("a", "Naspers profit rises", NOW, description="on stronger ecommerce"),
        row("b", "Second story", NOW - timedelta(days=1)),
    ])
    db_session.commit()
    assert repo.corpus_for_idf() == [
        "Naspers profit rises on stronger ecommerce",
        "Second story",
    ]
    assert repo.corpus_for_idf(limit=1) == ["Naspers profit rises on stronger ecommerce"]


def test_the_refresh_floor_blocks_a_second_fetch_and_expires_on_its_own(repo, db_session):
    assert repo.should_fetch("portfolio:NPN.JO", floor_hours=6) is True
    repo.record_fetch("portfolio:NPN.JO", "marketaux", 12, ok=True)
    db_session.commit()
    assert repo.should_fetch("portfolio:NPN.JO", floor_hours=6) is False
    assert repo.should_fetch("ticker:SBK.JO", floor_hours=6) is True
    assert repo.should_fetch("portfolio:NPN.JO", floor_hours=0) is True

def test_a_failed_fetch_does_not_hold_the_floor_closed(repo, db_session):
    repo.record_fetch("portfolio:NPN.JO", "marketaux", 0, ok=False)
    db_session.commit()
    assert repo.should_fetch("portfolio:NPN.JO", floor_hours=6) is True


def test_an_article_with_no_external_id_or_title_is_not_stored(repo):
    incomplete = row("", "No id")
    untitled = row("b", "")
    assert repo.upsert_articles([incomplete, untitled]) == (0, 0)
    assert repo.upsert_articles([]) == (0, 0)

def test_a_link_from_before_entities_were_checked_never_reaches_an_event(repo, db_session):
    old = row("old", "Vail Resorts lifts guidance", NOW, tickers=("MTN.JO",))
    old["tickers"][0]["match_score"] = None
    repo.upsert_articles([old, row("new", "MTN shares fall", NOW, tickers=("MTN.JO",))])
    db_session.commit()
    window = (NOW - timedelta(days=1), NOW + timedelta(days=1))
    assert [a.external_id for a in repo.articles_in_window("MTN.JO", *window)] == ["new"]
    assert [a["title"] for a in repo.linked_articles(["MTN.JO"], *window)["MTN.JO"]] == [
        "MTN shares fall"
    ]

def test_provenance_is_first_seen_and_a_second_sighting_only_adds_links(repo, db_session):
    first = NewsIngestRun(mode="backfill", status="ok")
    db_session.add(first)
    db_session.commit()
    repo.upsert_articles([row("a", "Naspers and Prosus")], ingest_mode="backfill",
                         run_id=first.id)
    db_session.commit()
    repo.upsert_articles([row("a", "Naspers and Prosus", tickers=("NPN.JO", "PRX.JO"))],
                         ingest_mode="on_demand")
    db_session.commit()
    stored = db_session.query(NewsArticle).one()
    assert stored.ingest_mode == "backfill"
    assert stored.first_ingest_run_id == first.id
    assert sorted(link.ticker for link in stored.tickers) == ["NPN.JO", "PRX.JO"]

def test_the_budget_counts_every_marketaux_call_since_midnight_utc(repo, db_session):
    midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    scopes = ["portfolio:A"] * 3 + ["backfill:MTN.JO:2026-07-31"] * 2 + ["nightly:A"]
    for scope in scopes:
        db_session.add(NewsFetchLog(scope=scope, source="marketaux", fetched_at=midnight))
    for _ in range(5):
        db_session.add(NewsFetchLog(scope="portfolio:A", source="marketaux",
                                    fetched_at=midnight - timedelta(seconds=1)))
    db_session.add(NewsFetchLog(scope="all", source="newsdata", fetched_at=midnight))
    db_session.commit()
    assert repo.calls_since("marketaux", midnight) == 6

def test_a_window_is_done_only_once_it_has_an_ok_row(repo, db_session):
    scope = "backfill:MTN.JO:2026-07-31"
    repo.record_fetch(scope, "marketaux", 0, ok=False)
    db_session.commit()
    assert repo.fetched_ok(scope) is False
    repo.record_fetch(scope, "marketaux", 0, ok=True)
    db_session.commit()
    assert repo.fetched_ok(scope) is True

def anomaly(rejected=None, z=-4.2):
    return {"ticker": "MTN.JO", "date": date(2026, 7, 31), "k_sigma": 3.0, "return_pct": -10.8,
            "z_score": z, "sigma": 0.0257, "direction": "down", "band": "very_unusual",
            "rejected": rejected}

def test_a_move_is_registered_once_and_a_resighting_keeps_its_first_run(repo, db_session):
    first = NewsIngestRun(mode="backfill", status="ok")
    second = NewsIngestRun(mode="nightly", status="ok")
    db_session.add_all([first, second])
    db_session.commit()
    repo.upsert_anomalies([anomaly()], first.id)
    db_session.commit()
    seen = db_session.query(PriceAnomaly).one().first_seen_at
    repo.upsert_anomalies([anomaly(rejected="spike", z=-4.3)], second.id)
    db_session.commit()
    row = db_session.query(PriceAnomaly).one()
    db_session.refresh(row)
    assert row.first_run_id == first.id
    assert row.first_seen_at == seen
    assert row.last_seen_at >= seen
    assert (row.validation, row.z_score) == ("spike", -4.3)

def test_the_same_day_at_another_threshold_is_another_row(repo, db_session):
    repo.upsert_anomalies([anomaly(), {**anomaly(), "k_sigma": 2.5}])
    db_session.commit()
    assert db_session.query(PriceAnomaly).count() == 2

def test_an_empty_scan_writes_nothing(repo, db_session):
    assert repo.upsert_anomalies([]) == 0
    assert db_session.query(PriceAnomaly).count() == 0

def test_the_latest_scan_is_the_newest_run_that_recorded_one(repo, db_session):
    older = NewsIngestRun(mode="nightly", status="ok", started_at=NOW,
                          details='{"scanned": {"MTN.JO": ["2025-10-02", "2026-06-09"]}}')
    newer = NewsIngestRun(mode="nightly", status="planned", started_at=NOW + timedelta(days=1),
                          details='{"event_windows": []}')
    db_session.add_all([older, newer])
    db_session.commit()
    run, scanned = repo.latest_scan()

    assert run.id == older.id
    assert scanned == {"MTN.JO": ["2025-10-02", "2026-06-09"]}

def test_with_no_scan_recorded_there_is_no_latest_scan(repo):
    assert repo.latest_scan() is None