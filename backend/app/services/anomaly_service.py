from __future__ import annotations

import logging
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models.news_event import NewsArticle
from app.repositories.news_repository import NewsRepository
from app.services.event_detection import K_SIGMA, score_series
from app.services.news_ranking import Bm25Index, score_articles
from app.services.risk_analytics import closes_for_tickers

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 90
HISTORY_PERIOD = "1y" 
MIN_COMBINED_SCORE = 0.35


def _as_ranking_input(article: NewsArticle) -> dict:
    return {
        "external_id": article.external_id,
        "title": article.title,
        "description": article.description,
        "url": article.url,
        "source_name": article.source_name,
        "published_at": article.published_at,
        "tickers": [link.ticker for link in article.tickers],
    }


def detect_anomalies(
    db: Session, priced_holdings: list[dict], k_sigma: float = K_SIGMA
) -> list[dict]:
    if not priced_holdings:
        return []

    tickers = [h["ticker"] for h in priced_holdings if h.get("ticker")]
    if not tickers:
        return []

    repo = NewsRepository(db)
    index = Bm25Index(repo.corpus_for_idf())
    series_by_ticker = closes_for_tickers(tickers, period=HISTORY_PERIOD)
    cutoff = date.today() - timedelta(days=LOOKBACK_DAYS)

    anomalies: list[dict] = []
    for h in priced_holdings:
        ticker = h.get("ticker")
        if not ticker:
            continue

        scored = score_series(series_by_ticker.get(ticker.upper(), []), k_sigma=k_sigma)
        if not scored["available"]:
            continue

        for event in scored["events"]:
            event_day = date.fromisoformat(event["date"])
            if event_day < cutoff:
                continue

            match = _best_article(repo, index, ticker, h.get("name") or "", event_day)
            if match is None:
                continue

            article = match["article"]
            anomalies.append({
                "date": event["date"],
                "ticker": ticker,
                "changePct": event["return_pct"],
                "zScore": event["z_score"],
                "headline": article["title"],
                "articleId": article["external_id"],
                "articleLink": article["url"],
                "articleSource": article["source_name"],
                "matchScore": match["combined"],
            })

    anomalies.sort(key=lambda a: a["date"])
    return anomalies


def _best_article(
    repo: NewsRepository, index: Bm25Index, ticker: str, name: str, event_day: date
) -> dict | None:
    candidates = repo.articles_in_window(
        ticker,
        datetime.combine(event_day - timedelta(days=7), time.min, tzinfo=UTC),
        datetime.combine(event_day + timedelta(days=2), time.max, tzinfo=UTC),
    )
    if not candidates:
        return None

    ranked = score_articles(
        [_as_ranking_input(a) for a in candidates], ticker, name, event_day, index
    )
    if not ranked:
        return None
    best = ranked[0]
    if best["bm25"] <= 0 or best["combined"] < MIN_COMBINED_SCORE:
        return None
    return best
