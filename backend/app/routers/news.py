import logging
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.news_event import NewsArticle
from app.models.portfolio import Holdings, Portfolios
from app.models.user import User
from app.repositories.news_repository import NewsRepository
from app.schemas.auth import UserResponse
from app.services import news_ingest
from app.services.ticker_map import canonical_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["importing news"])
_PORTFOLIO_NEWS_CACHE: dict[tuple[str, ...], tuple[float, dict]] = {}
_TICKER_NEWS_CACHE: dict[str, tuple[float, dict]] = {}
_NEWS_TTL_SECONDS = 300
_NEWS_CACHE_MAX_KEYS = 200

_BREAKER_FAILURE_LIMIT = 3
_BREAKER_PAUSE_SECONDS = 900
_breaker_failures = 0
_breaker_open_until = 0.0

EMPTY_ENVELOPE: dict[str, Any] = {
    "total_articles": 0,
    "positive": 0,
    "negative": 0,
    "neutral": 0,
    "results": [],
}


class NewsResponse(BaseModel):
    total_articles: int = Field(examples=[23])
    positive: int = Field(examples=[33])
    negative: int = Field(examples=[24])
    neutral: int = Field(examples=[23])
    results: list[dict[str, Any]]


class TickerNewsResponse(BaseModel):
    ticker: str = Field(examples=["NPN"])
    total_articles: int = Field(examples=[3])
    positive: int = Field(examples=[1])
    negative: int = Field(examples=[0])
    neutral: int = Field(examples=[2])
    articles: list[dict[str, Any]]


class TickerResponse(BaseModel):
    tickers: list[str] = Field(examples=[["AAPL", "MFST", "TSLA"]])


def _cache_get(cache: dict, key: object) -> dict | None:
    now = time.monotonic()
    for stale in [k for k, (cached_at, _) in cache.items() if now - cached_at >= _NEWS_TTL_SECONDS]:
        cache.pop(stale, None)
    entry = cache.get(key)
    return entry[1] if entry else None


def _cache_put(cache: dict, key: object, envelope: dict) -> None:
    if len(cache) >= _NEWS_CACHE_MAX_KEYS:
        oldest = min(cache, key=lambda k: cache[k][0])
        cache.pop(oldest, None)
    cache[key] = (time.monotonic(), envelope)


def _breaker_open() -> bool:
    return time.monotonic() < _breaker_open_until


def _record_provider_result(ok: bool) -> None:
    global _breaker_failures, _breaker_open_until
    if ok:
        _breaker_failures = 0
        _breaker_open_until = 0.0
        return
    _breaker_failures += 1
    if _breaker_failures >= _BREAKER_FAILURE_LIMIT:
        _breaker_open_until = time.monotonic() + _BREAKER_PAUSE_SECONDS
        logger.warning(
            "marketaux circuit breaker open for %ss after %s consecutive failures",
            _BREAKER_PAUSE_SECONDS,
            _breaker_failures,
        )


def reset_circuit_breaker() -> None:
    global _breaker_failures, _breaker_open_until
    _breaker_failures = 0
    _breaker_open_until = 0.0


def _newsdata_articles(params: dict) -> list[dict]:
    if not settings.newsdata_api_key:
        return []

    try:
        response = requests.get(
            "https://newsdata.io/api/1/latest",
            params={"apikey": settings.newsdata_api_key, "language": "en", **params},
            timeout=10,
        )
        data = response.json()
    except (requests.RequestException, ValueError):
        return []

    if "error" in data:
        return []

    return data.get("results", [])


def _count_newsdata_sentiment(articles: list[dict]) -> dict:
    positive = 0
    negative = 0
    neutral = 0

    for article in articles:
        sentiment = article.get("sentiment")

        if sentiment == "positive":
            positive += 1
        elif sentiment == "negative":
            negative += 1
        elif sentiment == "neutral":
            neutral += 1

    return {
        "total_articles": len(articles),
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "results": articles,
    }


@router.get("/all", response_model=NewsResponse)
def get_news(current_user: User = Depends(get_current_user)):
    return _count_newsdata_sentiment(_newsdata_articles({}))


@router.get("/", response_model=NewsResponse)
def get_news_by_category(
    category: str = "business",
    current_user: User = Depends(get_current_user),
):
    return _count_newsdata_sentiment(_newsdata_articles({"category": category}))


def _user_tickers(db: Session, user_id) -> list[str]:
    tickers = (
        db.query(Holdings.ticker)
        .join(Portfolios, Holdings.portfolio_id == Portfolios.id)
        .filter(
            Portfolios.user_id == user_id,
            Holdings.ticker.isnot(None),
            Holdings.ticker != "",
            Holdings.ticker != "None",
            Holdings.ticker != "none",
        )
        .distinct()
        .all()
    )

    return [ticker[0] for ticker in tickers]


@router.get("/portfolio-tickers", response_model=TickerResponse)
def get_portfolio_tickers(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"tickers": _user_tickers(db, current_user.id)}


def _iso_utc(value: datetime) -> str:
    aware = value if value.tzinfo else value.replace(tzinfo=UTC)
    return aware.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _for_storage(article: dict, wanted: Iterable[str]) -> dict | None:
    return news_ingest.normalise_article(article, {canonical_key(t) for t in wanted})


def _stored_article(row: NewsArticle) -> dict:
    return {
        "article_id": row.external_id,
        "title": row.title,
        "description": row.description,
        "image_url": row.image_url,
        "pubDate": _iso_utc(row.published_at) if row.published_at else None,
        "source_name": row.source_name,
        "category": [link.ticker for link in row.tickers],
        "sentiment": row.sentiment or "neutral",
        "sentiment_score": row.sentiment_score if row.sentiment_score is not None else 0,
    }


def _marketaux_result(
    symbols: list[str],
    published_after: str | None = None,
    published_before: str | None = None,
) -> news_ingest.ProviderResult | None:
    if not settings.market_api_key:
        return None
    if _breaker_open():
        logger.info("skipping marketaux call for %s, circuit breaker open", symbols)
        return None

    result = news_ingest.fetch_articles(
        symbols, news_ingest.ON_DEMAND_TIMEOUT_SECONDS, published_after, published_before
    )
    if not result.ok:
        logger.warning("marketaux %s for %s (http %s)", result.status, symbols, result.http_status)
    _record_provider_result(ok=result.ok)
    return result


def _marketaux_articles(
    symbols: list[str],
    published_after: str | None = None,
    published_before: str | None = None,
) -> list[dict] | None:
    result = _marketaux_result(symbols, published_after, published_before)
    return result.articles if result is not None and result.ok else None


def _refresh_from_provider(
    db: Session, repo: NewsRepository, scope: str, symbols: list[str]
) -> None:
    if not repo.should_fetch(scope, settings.news_refresh_floor_hours):
        return
    result = _marketaux_result(symbols)
    if result is None:
        return

    news_ingest.record_call(repo, scope, result)
    rows = [row for row in (_for_storage(a, symbols) for a in result.articles) if row]
    repo.upsert_articles(rows, ingest_mode="on_demand")
    db.commit()


def _portfolio_envelope(articles: list[dict]) -> dict:
    return {
        "total_articles": len(articles),
        "positive": sum(1 for a in articles if a["sentiment"] == "positive"),
        "negative": sum(1 for a in articles if a["sentiment"] == "negative"),
        "neutral": sum(1 for a in articles if a["sentiment"] == "neutral"),
        "results": articles,
    }


@router.get("/portfolio", response_model=NewsResponse)
def get_portfolio_news(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    tickers = _user_tickers(db, current_user.id)
    if not tickers:
        return dict(EMPTY_ENVELOPE)

    key = tuple(sorted(tickers))
    cached = _cache_get(_PORTFOLIO_NEWS_CACHE, key)
    if cached is not None:
        return cached

    repo = NewsRepository(db)
    _refresh_from_provider(db, repo, f"portfolio:{','.join(key)}", list(key))

    articles = [_stored_article(row) for row in repo.articles_for_tickers(list(key), limit=50)]
    envelope = _portfolio_envelope(articles)
    _cache_put(_PORTFOLIO_NEWS_CACHE, key, envelope)
    return envelope


def _empty_ticker_envelope(ticker: str) -> dict:
    return {
        "ticker": ticker,
        "total_articles": 0,
        "positive": 0,
        "negative": 0,
        "neutral": 0,
        "articles": [],
    }


@router.get(
    "/ticker/{ticker}",
    response_model=TickerNewsResponse,
    responses={404: {"description": "That ticker is not in the caller's portfolio"}},
)
def get_ticker_news(
    ticker: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if ticker.upper() not in {t.upper() for t in _user_tickers(db, current_user.id)}:
        raise HTTPException(status_code=404, detail=f"{ticker} is not in this portfolio")

    cached = _cache_get(_TICKER_NEWS_CACHE, ticker)
    if cached is not None:
        return cached

    repo = NewsRepository(db)
    _refresh_from_provider(db, repo, f"ticker:{ticker.upper()}", [ticker])

    articles = [_stored_article(row) for row in repo.articles_for_tickers([ticker], limit=20)]
    envelope = {
        "ticker": ticker,
        "total_articles": len(articles),
        "positive": sum(1 for a in articles if a["sentiment"] == "positive"),
        "negative": sum(1 for a in articles if a["sentiment"] == "negative"),
        "neutral": sum(1 for a in articles if a["sentiment"] == "neutral"),
        "articles": articles,
    }
    _cache_put(_TICKER_NEWS_CACHE, ticker, envelope)
    return envelope


# used by the portfolio snapshot pdf (routers/portfolio_snapshot.py). the keys come from settings,
# which reads backend.env as well as the process environment
def fetch_market_news(category: str = "business"):
    api_key = settings.newsdata_api_key

    response = requests.get(
        "https://newsdata.io/api/1/latest",
        params={
            "apikey": api_key,
            "category": category,
            "language": "en",
        },
        timeout=6,
    )

    data = response.json()

    return data


def fetch_ticker_news(ticker: str):
    api_key = settings.market_api_key

    try:
        response = requests.get(
            "https://api.marketaux.com/v1/news/all",
            params={
                "api_token": api_key,
                "symbols": ticker,
                "filter_entities": "true",
                "language": "en",
                "limit": 20,
            },
            timeout=15,
        )

        response.raise_for_status()

    except requests.exceptions.Timeout:
        logger.error("MarketAux timed out for ticker %s", ticker)
        return {
            "ticker": ticker,
            "total_articles": 0,
            "positive": 0,
            "negative": 0,
            "neutral": 0,
            "articles": [],
        }

    except requests.exceptions.RequestException as exc:
        logger.error("MarketAux request failed for %s: %s", ticker, exc)
        return {
            "ticker": ticker,
            "total_articles": 0,
            "positive": 0,
            "negative": 0,
            "neutral": 0,
            "articles": [],
        }

    data = response.json()

    return data
