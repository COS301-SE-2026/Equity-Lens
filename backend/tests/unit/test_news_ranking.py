"""BM25 and the three ranking components, against numbers worked out on paper.

The corpus fixtures are deliberately tiny and every document is the same length, so the IDF
and the length penalty can both be computed by hand.
"""
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

# four documents, three tokens each, so avgdl is exactly 3
CORPUS = [
    "naspers profit rises",
    "naspers cuts costs",
    "mining output falls",
    "bank profit falls",
]


def article(external_id, title, published, description=None, match_score=40.0):
    # every candidate now carries its link's match score. 40 is comfortably relevant, so these
    # tests are about the arithmetic and not the threshold. published at 08:00 UTC, which is
    # the same calendar day in Johannesburg
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
    # "naspers" is in 2 of 4 documents:
    #   idf = ln(1 + (N - df + 0.5) / (df + 0.5))
    #       = ln(1 + (4 - 2 + 0.5) / (2 + 0.5)) = ln(1 + 1) = ln 2
    assert index.idf("naspers") == pytest.approx(math.log(2))
    # "mining" is in 1 of 4:
    #   idf = ln(1 + 3.5 / 1.5) = ln(10/3)
    assert index.idf("mining") == pytest.approx(math.log(10 / 3))
    # a word the corpus has never seen still scores, it just scores the most
    assert index.idf("dividend") == pytest.approx(math.log(1 + 4.5 / 0.5))


def test_bm25_on_a_document_of_average_length_reduces_to_the_idf():
    # for a document of exactly average length the length penalty is
    #   k1 * (1 - b + b * dl/avgdl) = 1.5 * (1 - 0.75 + 0.75) = 1.5
    # and with the term appearing once,
    #   f * (k1 + 1) / (f + penalty) = 1 * 2.5 / (1 + 1.5) = 1
    # so the score is the idf itself
    index = Bm25Index(CORPUS)
    assert K1 == 1.5
    assert B == 0.75
    assert index.score(["naspers"], "naspers profit rises") == pytest.approx(math.log(2))


def test_a_longer_document_is_penalised():
    # six tokens against an average of three:
    #   penalty = 1.5 * (0.25 + 0.75 * 6/3) = 1.5 * 1.75 = 2.625
    #   score   = ln2 * 2.5 / (1 + 2.625)   = 0.693147 * 0.6896552 = 0.478032
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
        (0, 1.0),                      # exp(0)
        (1, math.exp(-1 / 8)),         # exp(-1 / (2 * 4))   = 0.8825
        (2, math.exp(-4 / 8)),         # exp(-4 / 8)         = 0.6065
        (3, math.exp(-9 / 8)),         # exp(-9 / 8)         = 0.3247
        (-1, math.exp(-1 / 8)),        # published the day after, same decay
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
    # every candidate is provider-tagged now, so the old 1.0-for-tagged told the reader nothing.
    # the headline naming the company is what separates them
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
    # the query terms are "npn" and "naspers". "npn" is not in the article, so bm25 is ln2
    # from "naspers" alone, as computed above
    assert row["bm25"] == pytest.approx(round(math.log(2), 4))
    # the ceiling is the sum of both terms' idf: idf(npn) = ln(1 + 4.5/0.5) = ln10, so
    #   bm25_abs = ln2 / (ln10 + ln2) = 0.693147 / 2.995732 = 0.2314
    # it used to be 1.0 here, only because this was the best of one candidate
    assert row["bm25_normalised"] == pytest.approx(0.2314, abs=1e-4)
    assert row["date_proximity"] == pytest.approx(round(math.exp(-1 / 8), 4))
    # "naspers" is in the headline
    assert row["entity_match"] == 1.0
    # combined = 0.5 * 0.2314 + 0.3 * 0.8825 + 0.2 * 1 = 0.1157 + 0.26475 + 0.2 = 0.5804
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
    # N = 3 and "npn" is in 1 of them:
    #   idf = ln(1 + (3 - 1 + 0.5) / (1 + 0.5)) = ln(1 + 2.5/1.5) = ln(2.6667) = 0.9808
    index = Bm25Index(["npn profit rises", "mining output falls", "bank profit falls"])
    assert index.idf("npn") == pytest.approx(0.9808, abs=1e-4)


def test_an_average_length_article_using_the_one_query_term_once_scores_exactly_one():
    # the query for ticker NPN.JO named "NPN" is just ["npn"], so the ceiling is idf(npn).
    # "npn profit rises" is 3 tokens, the average, so its bm25 is idf(npn) too (the length
    # penalty is 1.5 and 1 * 2.5 / (1 + 1.5) = 1), and bm25 / ceiling = 1.0
    corpus = ["npn profit rises", "mining output falls", "bank profit falls"]
    day = date(2026, 6, 10)

    ranked = score_articles(
        [article("a", "npn profit rises", day)], "NPN.JO", "NPN", day, Bm25Index(corpus)
    )

    assert ranked[0]["bm25_normalised"] == 1.0


def test_a_late_evening_utc_article_is_the_next_day_in_johannesburg():
    # 23:30 UTC on the 9th is 01:30 SAST on the 10th, so for a JSE holding it is an event-day
    # article, not one from the day before
    published = datetime(2026, 6, 9, 23, 30, tzinfo=UTC)
    assert local_date(published, "NPN.JO") == date(2026, 6, 10)
    # for a US holding, UTC-5 keeps it on the 9th (18:30)
    assert local_date(published, "AAPL") == date(2026, 6, 9)


def test_a_us_article_just_after_midnight_utc_is_still_the_previous_day_in_new_york():
    # 03:00 UTC on the 10th is 22:00 on the 9th at UTC-5
    assert local_date(datetime(2026, 6, 10, 3, 0, tzinfo=UTC), "AAPL") == date(2026, 6, 9)


def test_the_match_score_threshold_is_inclusive_at_25():
    assert MIN_ENTITY_MATCH_SCORE == 25.0
    assert is_relevant(24.9, named=False) is False
    assert is_relevant(25.0, named=False) is True
    # a pre-migration link has no score and is never evidence, headline or not
    assert is_relevant(None, named=True) is False


def test_a_passing_mention_is_saved_by_the_headline_naming_the_company():
    # 12.6 is the probe's De Beers article, where Anglo American was only the parent - under
    # the threshold on its own. the same score with the company in the headline counts
    terms = query_terms("AGL.JO", "Anglo American plc")
    day = date(2026, 6, 10)

    about = article("a", "Anglo American weighs De Beers sale", day, match_score=12.6)
    passing = article("b", "De Beers cuts diamond prices", day, match_score=12.6)

    assert counts_as_evidence(about, "AGL.JO", terms, day) is True
    assert counts_as_evidence(passing, "AGL.JO", terms, day) is False


def test_evidence_has_to_sit_in_the_local_window():
    # the window is [-3, +1] days: the 7th is day -3 and counts, the 6th is day -4 and does not
    terms = query_terms("NPN.JO", "Naspers Limited")
    day = date(2026, 6, 10)

    assert counts_as_evidence(article("in", "Naspers news", date(2026, 6, 7)), "NPN.JO", terms,
                              day) is True
    assert counts_as_evidence(article("out", "Naspers news", date(2026, 6, 6)), "NPN.JO", terms,
                              day) is False


@pytest.mark.parametrize(
    ("published", "title", "expected"),
    [
        # named in the headline, the day before: close
        (date(2026, 6, 9), "Naspers profit rises", "close"),
        # named, but two days before: outside |days| <= 1, so related
        (date(2026, 6, 8), "Naspers profit rises", "related"),
        # the day itself, but the headline does not name it: related
        (date(2026, 6, 10), "Tech stocks slide", "related"),
    ],
)
def test_relevance_is_close_only_when_named_and_within_a_day(published, title, expected):
    ranked = score_articles(
        [article("a", title, published)], "NPN.JO", "Naspers Limited", date(2026, 6, 10),
        Bm25Index(CORPUS),
    )
    assert ranked[0]["relevance"] == expected
