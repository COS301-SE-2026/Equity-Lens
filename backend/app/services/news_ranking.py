from __future__ import annotations

import math
import re
from collections import Counter
from datetime import UTC, date, datetime, timedelta

from app.services.ticker_map import listing_country

K1 = 1.5
B = 0.75
PROXIMITY_SIGMA_DAYS = 2.0
MAX_DAYS_BEFORE = 3
MAX_DAYS_AFTER = 1

WEIGHT_BM25 = 0.5
WEIGHT_PROXIMITY = 0.3
WEIGHT_ENTITY = 0.2
MIN_ENTITY_MATCH_SCORE = 25.0
UTC_OFFSET_HOURS = {"za": 2, "us": -5}

_CORPORATE_SUFFIXES = {"limited", "group", "holdings", "plc", "ltd"}

_TOKEN = re.compile(r"[a-z0-9]+")


def _display_keyword(name: str) -> str:
    words = (name or "").split()
    while words and words[-1].lower() in _CORPORATE_SUFFIXES:
        words.pop()
    return " ".join(words) or (name or "")


def _ticker_keyword(ticker: str) -> str:
    return (ticker or "").split(".")[0]


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall((text or "").lower())


def query_terms(ticker: str, name: str) -> list[str]:
    """The terms an article has to talk about to be about this holding."""
    terms = tokenize(_ticker_keyword(ticker)) + tokenize(_display_keyword(name))
    seen = []
    for term in terms:
        if term not in seen:
            seen.append(term)
    return seen


class Bm25Index:
    def __init__(self, corpus: list[str]):
        self.document_count = len(corpus)
        self.document_frequency: Counter = Counter()
        total_length = 0

        for document in corpus:
            tokens = tokenize(document)
            total_length += len(tokens)
            self.document_frequency.update(set(tokens))

        self.average_length = (total_length / self.document_count) if self.document_count else 0.0

    def idf(self, term: str) -> float:
        if not self.document_count:
            return 0.0
        df = self.document_frequency.get(term, 0)
        return math.log(1 + (self.document_count - df + 0.5) / (df + 0.5))

    def ceiling(self, terms: list[str]) -> float:
        return sum(self.idf(term) for term in terms)

    def score(self, terms: list[str], document: str) -> float:
        tokens = tokenize(document)
        if not tokens or not self.average_length:
            return 0.0

        counts = Counter(tokens)
        length_penalty = K1 * (1 - B + B * len(tokens) / self.average_length)

        total = 0.0
        for term in terms:
            frequency = counts.get(term, 0)
            if not frequency:
                continue
            total += self.idf(term) * frequency * (K1 + 1) / (frequency + length_penalty)
        return total


def date_proximity(published: date, event_day: date) -> float | None:
    days_before = (event_day - published).days
    if days_before > MAX_DAYS_BEFORE or days_before < -MAX_DAYS_AFTER:
        return None
    return math.exp(-(days_before ** 2) / (2 * PROXIMITY_SIGMA_DAYS ** 2))


def local_date(published: datetime, ticker: str) -> date:
    aware = published if published.tzinfo else published.replace(tzinfo=UTC)
    offset = timedelta(hours=UTC_OFFSET_HOURS[listing_country(ticker)])
    return (aware.astimezone(UTC) + offset).date()


def named_in_headline(title: str | None, terms: list[str]) -> bool:
    headline = set(tokenize(title or ""))
    return any(term in headline for term in terms)


def is_relevant(match_score: float | None, named: bool) -> bool:
    if match_score is None:
        return False
    return match_score >= MIN_ENTITY_MATCH_SCORE or named


def counts_as_evidence(article: dict, ticker: str, terms: list[str], event_day: date) -> bool:
    day = local_date(article["published_at"], ticker)
    if date_proximity(day, event_day) is None:
        return False
    return is_relevant(article.get("match_score"), named_in_headline(article.get("title"), terms))


def score_articles(
    articles: list[dict], ticker: str, name: str, event_day: date, index: Bm25Index
) -> list[dict]:
    terms = query_terms(ticker, name)
    ceiling = index.ceiling(terms)

    scored: list[dict] = []
    for article in articles:
        if article.get("published_at") is None:
            continue
        if not counts_as_evidence(article, ticker, terms, event_day):
            continue

        day = local_date(article["published_at"], ticker)
        proximity = date_proximity(day, event_day) or 0.0
        named = named_in_headline(article.get("title"), terms)
        entity = 1.0 if named else 0.5

        document = f"{article.get('title') or ''} {article.get('description') or ''}"
        bm25 = index.score(terms, document)
        bm25_abs = min(1.0, bm25 / ceiling) if ceiling > 0 else 0.0
        days_from_event = (day - event_day).days

        scored.append({
            "article": article,
            "bm25": round(bm25, 4),
            "bm25_normalised": round(bm25_abs, 4),
            "date_proximity": round(proximity, 4),
            "entity_match": entity,
            "combined": round(
                WEIGHT_BM25 * bm25_abs + WEIGHT_PROXIMITY * proximity + WEIGHT_ENTITY * entity,
                4,
            ),
            "named_in_headline": named,
            "days_from_event": days_from_event,
            "relevance": "close" if named and abs(days_from_event) <= 1 else "related",
        })

    scored.sort(key=lambda row: row["combined"], reverse=True)
    return scored
