import math
from datetime import UTC, date, datetime, timedelta

import pytest

from app.services.news_ranking import (
    K1,
    MIN_ENTITY_MATCH_SCORE,
    B,
    Bm25Index,
    _display_keyword,
    _ticker_keyword,
    counts_as_evidence,
    date_proximity,
    is_relevant,
    local_date,
    query_terms,
    score_articles,
    tokenize,
)

CORPUS = [
    "naspers profit rises",
    "naspers cuts costs",
    "mining output falls",
    "bank profit falls",
]


def article(external_id, title, published, description=None, match_score=40.0):
    return {
        "external_id": external_id,
        "title": title,
        "description": description,
        "url": f"https://example.com/{external_id}",
        "source_name": "Example",
        "published_at": datetime.combine(published, datetime.min.time(), tzinfo=UTC)
        + timedelta(hours=8),
        "match_score": match_score,
    }


def test_idf_matches_the_formula():
    index = Bm25Index(CORPUS)

    assert index.document_count == 4
    assert index.average_length == 3.0
    assert index.idf("naspers") == pytest.approx(math.log(2))
    assert index.idf("mining") == pytest.approx(math.log(10 / 3))
    assert index.idf("dividend") == pytest.approx(math.log(1 + 4.5 / 0.5))


def test_bm25_on_a_document_of_average_length_reduces_to_the_idf():
    index = Bm25Index(CORPUS)
    assert K1 == 1.5
    assert B == 0.75
    assert index.score(["naspers"], "naspers profit rises") == pytest.approx(math.log(2))


def test_a_longer_document_is_penalised():
    index = Bm25Index(CORPUS)
    long_document = "naspers said today that costs fell"

    assert len(tokenize(long_document)) == 6
    assert index.score(["naspers"], long_document) == pytest.approx(0.478032, abs=1e-6)


def test_an_empty_corpus_scores_nothing_rather_than_dividing_by_zero():
    index = Bm25Index([])
    assert index.score(["naspers"], "naspers profit rises") == 0.0


@pytest.mark.parametrize(
    ("days_before", "expected"),
    [
        (0, 1.0),
        (1, math.exp(-1 / 8)),
        (2, math.exp(-4 / 8)),
        (3, math.exp(-9 / 8)),
        (-1, math.exp(-1 / 8)),
    ],
)
def test_date_proximity_is_a_gaussian_on_days_before(days_before, expected):
    event_day = date(2026, 6, 10)
    published = event_day - timedelta(days=days_before)

    assert date_proximity(published, event_day) == pytest.approx(expected)


@pytest.mark.parametrize("days_before", [4, 10, -2])
def test_articles_outside_the_window_are_excluded_not_scored_low(days_before):
    event_day = date(2026, 6, 10)
    published = event_day - timedelta(days=days_before)

    assert date_proximity(published, event_day) is None


def test_entity_strength_is_higher_when_the_headline_names_the_company():
    index = Bm25Index(CORPUS)
    day = date(2026, 6, 10)

    ranked = score_articles(
        [
            article("named", "Naspers announces a buyback", day),
            article("tagged", "Something happened", day),
        ],
        "NPN.JO", "Naspers Limited", day, index,
    )
    by_id = {row["article"]["external_id"]: row for row in ranked}

    assert by_id["named"]["entity_match"] == 1.0
    assert by_id["named"]["named_in_headline"] is True
    assert by_id["tagged"]["entity_match"] == 0.5
    assert by_id["tagged"]["named_in_headline"] is False


def test_the_keyword_helpers_behave_as_they_did_in_anomaly_service():
    assert _display_keyword("Naspers Limited") == "Naspers"
    assert _display_keyword("Standard Bank Group") == "Standard Bank"
    assert _display_keyword("Anglo American plc") == "Anglo American"
    assert _display_keyword("") == ""
    assert _ticker_keyword("NPN.JO") == "NPN"
    assert _ticker_keyword("") == ""


def test_query_terms_drops_duplicates_between_the_ticker_and_the_name():
    assert query_terms("SBK.JO", "Standard Bank Group") == ["sbk", "standard", "bank"]
    assert query_terms("NPN.JO", "Naspers Limited") == ["npn", "naspers"]


def test_the_three_components_reach_the_caller_separately():
    index = Bm25Index(CORPUS)
    event_day = date(2026, 6, 10)

    ranked = score_articles(
        [article("a", "naspers profit rises", date(2026, 6, 9))],
        "NPN.JO", "Naspers Limited", event_day, index,
    )

    row = ranked[0]
    assert row["bm25"] == pytest.approx(round(math.log(2), 4))
    assert row["bm25_normalised"] == pytest.approx(0.2314, abs=1e-4)
    assert row["date_proximity"] == pytest.approx(round(math.exp(-1 / 8), 4))
    assert row["entity_match"] == 1.0
    assert row["combined"] == pytest.approx(0.5804, abs=5e-4)


def test_ranking_puts_the_on_topic_article_above_the_merely_recent_one():
    index = Bm25Index(CORPUS)
    event_day = date(2026, 6, 10)

    ranked = score_articles(
        [
            article("off", "mining output falls", event_day),
            article("on", "naspers profit rises", event_day),
        ],
        "NPN.JO", "Naspers Limited", event_day, index,
    )

    assert [row["article"]["external_id"] for row in ranked] == ["on", "off"]
    assert ranked[0]["date_proximity"] == ranked[1]["date_proximity"]


def test_an_article_out_of_the_date_window_is_not_returned_at_all():
    index = Bm25Index(CORPUS)
    event_day = date(2026, 6, 10)

    ranked = score_articles(
        [article("old", "naspers profit rises", date(2026, 6, 1))],
        "NPN.JO", "Naspers Limited", event_day, index,
    )

    assert ranked == []


def test_idf_on_a_three_document_corpus():
    index = Bm25Index(["npn profit rises", "mining output falls", "bank profit falls"])
    assert index.idf("npn") == pytest.approx(0.9808, abs=1e-4)


def test_an_average_length_article_using_the_one_query_term_once_scores_exactly_one():
    corpus = ["npn profit rises", "mining output falls", "bank profit falls"]
    day = date(2026, 6, 10)

    ranked = score_articles(
        [article("a", "npn profit rises", day)], "NPN.JO", "NPN", day, Bm25Index(corpus)
    )

    assert ranked[0]["bm25_normalised"] == 1.0


def test_a_late_evening_utc_article_is_the_next_day_in_johannesburg():
    published = datetime(2026, 6, 9, 23, 30, tzinfo=UTC)
    assert local_date(published, "NPN.JO") == date(2026, 6, 10)
    assert local_date(published, "AAPL") == date(2026, 6, 9)


def test_a_us_article_just_after_midnight_utc_is_still_the_previous_day_in_new_york():
    assert local_date(datetime(2026, 6, 10, 3, 0, tzinfo=UTC), "AAPL") == date(2026, 6, 9)


def test_the_match_score_threshold_is_inclusive_at_25():
    assert MIN_ENTITY_MATCH_SCORE == 25.0
    assert is_relevant(24.9, named=False) is False
    assert is_relevant(25.0, named=False) is True
    assert is_relevant(None, named=True) is False


def test_a_passing_mention_is_saved_by_the_headline_naming_the_company():
    terms = query_terms("AGL.JO", "Anglo American plc")
    day = date(2026, 6, 10)

    about = article("a", "Anglo American weighs De Beers sale", day, match_score=12.6)
    passing = article("b", "De Beers cuts diamond prices", day, match_score=12.6)

    assert counts_as_evidence(about, "AGL.JO", terms, day) is True
    assert counts_as_evidence(passing, "AGL.JO", terms, day) is False


def test_evidence_has_to_sit_in_the_local_window():
    terms = query_terms("NPN.JO", "Naspers Limited")
    day = date(2026, 6, 10)

    assert counts_as_evidence(article("in", "Naspers news", date(2026, 6, 7)), "NPN.JO", terms,
                              day) is True
    assert counts_as_evidence(article("out", "Naspers news", date(2026, 6, 6)), "NPN.JO", terms,
                              day) is False


@pytest.mark.parametrize(
    ("published", "title", "expected"),
    [
        (date(2026, 6, 9), "Naspers profit rises", "close"),
        (date(2026, 6, 8), "Naspers profit rises", "related"),
        (date(2026, 6, 10), "Tech stocks slide", "related"),
    ],
)
def test_relevance_is_close_only_when_named_and_within_a_day(published, title, expected):
    ranked = score_articles(
        [article("a", title, published)], "NPN.JO", "Naspers Limited", date(2026, 6, 10),
        Bm25Index(CORPUS),
    )
    assert ranked[0]["relevance"] == expected