"""What gets linked, and how a run behaves when marketaux says no.

The linking tests read the recorded marketaux responses in tests/fixtures/marketaux when they
are there, and the _synthetic stand-ins built from the same entity shapes when they are not, so
the assertions are about properties any real response has to satisfy rather than about one
article's exact text.
"""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.models.news_event import NewsArticle, NewsFetchLog, NewsIngestRun
from app.services import news_ingest
from app.services.news_ingest import PlannedCall, ProviderResult

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "marketaux"


def payload(name):
    recorded = FIXTURES / f"{name}.json"
    if recorded.exists():
        body = json.loads(recorded.read_text())
        if body.get("data"):
            return body
    return json.loads((FIXTURES / f"{name}_synthetic.json").read_text())


def entities_of(body, **match):
    return [
        (article, entity)
        for article in body["data"]
        for entity in article.get("entities", [])
        if all(entity.get(k) == v for k, v in match.items())
    ]


def test_vail_resorts_is_never_filed_under_mtn_group():
    # symbols=MTN is Vail Resorts on the NYSE. the old fallback split MTN.JO to MTN and linked it
    body = payload("vail_mtn_collision")
    vail = entities_of(body, symbol="MTN")
    assert vail, "the collision fixture should carry the bare MTN entity"

    for article, _ in vail:
        row = news_ingest.normalise_article(article, {"MTN.JO"})
        assert all(t["ticker"] != "MTN.JO" for t in row["tickers"])
        assert "symbol_mismatch" in {r["reason"] for r in row["rejected"]}


def test_an_mtn_jo_entity_is_linked_with_its_score_and_country():
    body = payload("jse_mtn_sbk_latest")
    tagged = entities_of(body, symbol="MTN.JO", country="za", type="equity")
    assert tagged, "the JSE fixture should carry an MTN.JO equity entity"

    for article, entity in tagged:
        row = news_ingest.normalise_article(article, {"MTN.JO", "SBK.JO"})
        link = next(t for t in row["tickers"] if t["ticker"] == "MTN.JO")
        assert link["match_score"] == entity["match_score"]
        assert link["entity_country"] == "za"


def test_an_index_entity_is_not_a_company_even_when_its_symbol_is_asked_for():
    body = payload("za_mixed_entities")
    indices = entities_of(body, type="index")
    assert indices, "the mixed fixture should carry an index entity"

    for article, entity in indices:
        symbol = entity["symbol"].upper()
        row = news_ingest.normalise_article(article, {symbol})
        assert all(t["ticker"] != symbol for t in row["tickers"])
        assert {"symbol": entity["symbol"], "reason": "not_equity"}.items() <= next(
            r for r in row["rejected"] if r["symbol"] == entity["symbol"]
        ).items()


def test_a_us_history_article_links_to_aapl():
    body = payload("aapl_history_window")
    tagged = entities_of(body, symbol="AAPL", type="equity")
    assert tagged

    for article, _ in tagged:
        row = news_ingest.normalise_article(article, {"AAPL"})
        assert [t["ticker"] for t in row["tickers"]] == ["AAPL"]


def test_the_right_symbol_from_the_wrong_country_is_rejected():
    entity = {"symbol": "MTN.JO", "country": "us", "type": "equity"}
    assert news_ingest.link_entity(entity, {"MTN.JO"}) == (None, "country_mismatch")
    # and the case of the provider's symbol does not matter
    entity = {"symbol": "mtn.jo", "country": "ZA", "type": "equity"}
    assert news_ingest.link_entity(entity, {"MTN.JO"}) == ("MTN.JO", None)


def test_the_highlight_is_the_marked_one_as_plain_text():
    highlights = [
        {"highlight": "A warm welcome to everybody on the call."},
        {"highlight": "<em>MTN Group</em> said data revenue grew [+212 characters]"},
    ]
    # the greeting has no <em>, so the second one is taken; tags and the free plan's
    # truncation marker both go
    assert news_ingest.clean_highlight(highlights) == "MTN Group said data revenue grew"


def test_a_long_highlight_is_cut_to_300_characters_and_none_without_a_mark():
    long_text = "<em>Apple</em> " + "x" * 400
    assert len(news_ingest.clean_highlight([{"highlight": long_text}])) == 300
    assert news_ingest.clean_highlight([{"highlight": "no mark here"}]) is None
    assert news_ingest.clean_highlight(None) is None


def test_an_article_missing_its_id_title_or_date_is_not_normalised():
    good = {"uuid": "a", "title": "t", "published_at": "2026-09-01T00:00:00Z"}
    assert news_ingest.normalise_article(good, set()) is not None
    assert news_ingest.normalise_article({**good, "uuid": None}, set()) is None
    assert news_ingest.normalise_article({**good, "title": ""}, set()) is None
    assert news_ingest.normalise_article({**good, "published_at": "yesterday"}, set()) is None


def _response(status, body=None, raises=False):
    response = MagicMock()
    response.status_code = status
    if raises:
        response.json.side_effect = ValueError("not json")
    else:
        response.json.return_value = body
    return response


@pytest.mark.parametrize(
    ("status", "body", "expected"),
    [
        (200, {"data": [{"uuid": "a"}]}, "ok"),
        (200, {"data": []}, "empty"),
        (402, {"error": {"code": "usage_limit_reached"}}, "quota_exhausted"),
        (429, None, "rate_limited"),
        (401, {"error": {"code": "invalid_api_token"}}, "auth_error"),
        (403, {"error": {"code": "endpoint_access_restricted"}}, "auth_error"),
        (503, None, "provider_error"),
        (200, {"meta": {}}, "malformed"),
    ],
)
def test_each_answer_marketaux_can_give_has_one_status(status, body, expected):
    assert news_ingest._read_response(_response(status, body)).status == expected


def test_a_rate_limit_page_that_is_not_json_is_still_a_rate_limit():
    # a 429 comes back as html, which used to raise out of .json()
    assert news_ingest._read_response(_response(429, raises=True)).status == "rate_limited"


def _article(uuid, symbol="NPN.JO"):
    return {
        "uuid": uuid, "title": f"Naspers story {uuid}", "published_at": "2026-09-01T08:00:00Z",
        "source": "Example",
        "entities": [{"symbol": symbol, "country": "za", "type": "equity", "match_score": 40.0}],
    }


def _calls(n):
    return [PlannedCall(scope=f"backfill:NPN.JO:2026-07-0{i + 1}", symbols=["NPN.JO"])
            for i in range(n)]


def _run(db_session, results, calls, write=True, budget=80):
    run = news_ingest.start_run(db_session, "backfill")
    with patch.object(news_ingest, "fetch_articles", side_effect=results) as provider, \
         patch.object(news_ingest.time, "sleep") as sleep:
        outcomes = news_ingest.run_calls(db_session, run, calls, "backfill", write=write,
                                         budget=budget)
    return run, outcomes, provider, sleep


def test_a_429_is_waited_out_once_and_the_retry_is_used(db_session):
    results = [ProviderResult("rate_limited", 429), ProviderResult("ok", 200, [_article("a")])]

    run, _, provider, sleep = _run(db_session, results, _calls(1))

    assert provider.call_count == 2
    sleep.assert_any_call(news_ingest.RATE_LIMIT_PAUSE_SECONDS)
    assert run.status == "ok"
    assert run.articles_new == 1
    # both attempts are in the ledger, because both cost a request
    assert db_session.query(NewsFetchLog).count() == run.requests_made == 2


def test_a_402_stops_the_run_and_keeps_what_was_stored(db_session):
    results = [
        ProviderResult("ok", 200, [_article("a"), _article("b")]),
        ProviderResult("quota_exhausted", 402, error_code="usage_limit_reached"),
        ProviderResult("ok", 200, [_article("never")]),
    ]

    run, _, provider, _ = _run(db_session, results, _calls(3))

    assert provider.call_count == 2
    assert run.status == "partial"
    assert run.articles_new == 2
    assert db_session.query(NewsArticle).count() == 2


def test_a_malformed_article_is_counted_and_skipped_and_the_rest_are_stored(db_session):
    broken = {"uuid": "c", "title": "", "published_at": "2026-09-01T08:00:00Z"}
    results = [ProviderResult("ok", 200, [_article("a"), broken, _article("b")])]

    run, _, _, _ = _run(db_session, results, _calls(1))

    assert run.articles_received == 3
    assert run.articles_malformed == 1
    assert run.articles_new == 2
    assert run.links_new == 2


def test_a_timeout_is_retried_once_after_five_seconds(db_session):
    results = [ProviderResult("provider_error", error_code="timeout"),
               ProviderResult("ok", 200, [_article("a")])]

    run, _, provider, sleep = _run(db_session, results, _calls(1))

    assert provider.call_count == 2
    sleep.assert_any_call(news_ingest.RETRY_PAUSE_SECONDS)
    assert run.status == "ok"


def test_three_failed_batches_in_a_row_stop_the_run(db_session):
    # every batch fails twice (the call and its retry), so three batches are six calls and the
    # fourth batch is never tried
    results = [ProviderResult("provider_error", 503)] * 8

    run, _, provider, _ = _run(db_session, results, _calls(4))

    assert provider.call_count == 6
    assert run.status == "partial"


def test_a_budget_of_two_stops_a_five_call_plan_after_two(db_session):
    results = [ProviderResult("ok", 200, [_article(str(i))]) for i in range(5)]

    run, _, provider, _ = _run(db_session, results, _calls(5), budget=2)

    assert provider.call_count == 2
    assert run.status == "partial"
    assert "budget" in run.error_summary


def test_a_rejected_key_fails_the_run_rather_than_retrying(db_session):
    results = [ProviderResult("auth_error", 401), ProviderResult("ok", 200, [])]

    run, _, provider, _ = _run(db_session, results, _calls(2))

    assert provider.call_count == 1
    assert run.status == "failed"


def test_every_run_leaves_exactly_one_row_even_when_something_breaks(db_session):
    run = news_ingest.start_run(db_session, "backfill")
    with patch.object(news_ingest, "fetch_articles", side_effect=RuntimeError("boom")), \
         patch.object(news_ingest.time, "sleep"):
        news_ingest.run_calls(db_session, run, _calls(1), "backfill")

    rows = db_session.query(NewsIngestRun).all()
    assert len(rows) == 1
    assert rows[0].status == "failed"
    assert "boom" in rows[0].error_summary


def test_a_dry_run_calls_and_validates_but_stores_no_article(db_session):
    results = [ProviderResult("ok", 200, [_article("a")])]

    run, outcomes, _, _ = _run(db_session, results, _calls(1), write=False)

    assert run.status == "dry_run"
    assert db_session.query(NewsArticle).count() == 0
    assert [t["ticker"] for t in outcomes[0]["rows"][0]["tickers"]] == ["NPN.JO"]


def test_rejected_entities_are_counted_by_reason(db_session):
    article = _article("a")
    article["entities"] += [
        {"symbol": "MTN", "country": "us", "type": "equity", "match_score": 50.0},
        {"symbol": "NPN.JO", "country": "za", "type": "index", "match_score": 50.0},
    ]
    run, _, _, _ = _run(db_session, [ProviderResult("ok", 200, [article])], _calls(1))

    assert run.links_rejected == 2
    assert json.loads(run.details)["reasons"] == {"symbol_mismatch": 1, "not_equity": 1}
