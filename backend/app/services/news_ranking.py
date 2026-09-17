from __future__ import annotations

import math
import re
from collections import Counter
from datetime import date

K1 = 1.5
B = 0.75
PROXIMITY_SIGMA_DAYS = 2.0
MAX_DAYS_BEFORE = 3
MAX_DAYS_AFTER = 1

WEIGHT_BM25 = 0.5
WEIGHT_PROXIMITY = 0.3
WEIGHT_ENTITY = 0.2

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


def entity_match(article: dict, ticker: str, terms: list[str]) -> float:
    linked = {t.upper() for t in article.get("tickers", []) if t}
    if ticker.upper() in linked:
        return 1.0

    headline = set(tokenize(article.get("title") or ""))
    return 0.5 if any(term in headline for term in terms) else 0.0


def score_articles(
    articles: list[dict], ticker: str, name: str, event_day: date, index: Bm25Index
) -> list[dict]:
    terms = query_terms(ticker, name)

    raw: list[tuple[dict, float, float, float]] = []
    for article in articles:
        published = article.get("published_at")
        if published is None:
            continue
        day = published.date() if hasattr(published, "date") else published
        proximity = date_proximity(day, event_day)
        if proximity is None:
            continue

        document = f"{article.get('title') or ''} {article.get('description') or ''}"
        raw.append((
            article,
            index.score(terms, document),
            proximity,
            entity_match(article, ticker, terms),
        ))

    best = max((bm25 for _, bm25, _, _ in raw), default=0.0)

    scored: list[dict] = []
    for article, bm25, proximity, entity in raw:
        normalised = bm25 / best if best > 0 else 0.0
        scored.append({
            "article": article,
            "bm25": round(bm25, 4),
            "bm25_normalised": round(normalised, 4),
            "date_proximity": round(proximity, 4),
            "entity_match": entity,
            "combined": round(
                WEIGHT_BM25 * normalised
                + WEIGHT_PROXIMITY * proximity
                + WEIGHT_ENTITY * entity,
                4,
            ),
        })

    scored.sort(key=lambda row: row["combined"], reverse=True)
    return scored
