import time
from typing import Any

import requests
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.portfolio import Holdings, Portfolios
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/news", tags=["importing news"])
_PORTFOLIO_NEWS_CACHE: dict[tuple[str, ...], tuple[float, dict]] = {}
_TICKER_NEWS_CACHE: dict[str, tuple[float, dict]] = {}
_NEWS_TTL_SECONDS = 900

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
    articles: list[dict[str,Any]]

class TickerResponse(BaseModel):
    tickers: list[str] = Field(examples=[["AAPL", "MFST", "TSLA"]])


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
  tickers = (db.query(Holdings.ticker).join(Portfolios, Holdings.portfolio_id == Portfolios.id)
              .filter(Portfolios.user_id == user_id, Holdings.ticker.isnot(None), Holdings.ticker != "", Holdings.ticker != "None",Holdings.ticker != "none")
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


def _to_article(article: dict, tickers: set[str]) -> dict:
    entity = next(
        (e for e in article.get("entities", []) if e.get("symbol") in tickers),
        None,
    )
    score = entity.get("sentiment_score") if entity else None

    sentiment = "neutral"
    if score is not None and score > 0:
        sentiment = "positive"
    elif score is not None and score < 0:
        sentiment = "negative"

    return {
        "article_id": article.get("uuid"),
        "title": article.get("title"),
        "description": article.get("description"),
        "image_url": article.get("image_url"),
        "pubDate": article.get("published_at"),
        "source_name": article.get("source"),
        "category": [entity.get("symbol")] if entity else [],
        "sentiment": sentiment,
        "sentiment_score": score if score is not None else 0,
    }


def _fetch_portfolio_news(tickers: list[str]) -> dict:
    if not settings.market_api_key:
        return dict(EMPTY_ENVELOPE)

    try:
        response = requests.get(
            "https://api.marketaux.com/v1/news/all",
            params={
                "api_token": settings.market_api_key,
                "symbols": ",".join(tickers),
                "filter_entities": "true",
                "language": "en",
                "limit": 50,
            },
            timeout=6,
        )
        payload = response.json()
    except (requests.RequestException, ValueError):
        return dict(EMPTY_ENVELOPE)

    if "error" in payload:
        return dict(EMPTY_ENVELOPE)

    wanted = set(tickers)
    results = [_to_article(article, wanted) for article in payload.get("data", [])]

    return {
        "total_articles": len(results),
        "positive": sum(1 for r in results if r["sentiment"] == "positive"),
        "negative": sum(1 for r in results if r["sentiment"] == "negative"),
        "neutral": sum(1 for r in results if r["sentiment"] == "neutral"),
        "results": results,
    }


@router.get("/portfolio", response_model=NewsResponse)
def get_portfolio_news(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tickers = _user_tickers(db, current_user.id)
    if not tickers:
        return dict(EMPTY_ENVELOPE)

    key = tuple(sorted(tickers))
    cached = _PORTFOLIO_NEWS_CACHE.get(key)
    if cached and time.monotonic() - cached[0] < _NEWS_TTL_SECONDS:
        return cached[1]

    envelope = _fetch_portfolio_news(list(key))
    _PORTFOLIO_NEWS_CACHE[key] = (time.monotonic(), envelope)
    return envelope


def _empty_ticker_envelope(ticker: str) -> dict:
    return {"ticker": ticker, "total_articles": 0, "positive": 0, "negative": 0,
            "neutral": 0, "articles": []}


def _fetch_ticker_news(ticker: str) -> dict:
    if not settings.market_api_key:
        return _empty_ticker_envelope(ticker)

    try:
        response = requests.get(
            "https://api.marketaux.com/v1/news/all",
            params={
                "api_token": settings.market_api_key,
                "symbols": ticker,
                "filter_entities": "true",
                "language": "en",
                "limit": 20
            },
            timeout=6,
        )
        data = response.json()
    except (requests.RequestException, ValueError):
        data = {"error": "upstream unavailable"}

    if "error" in data:
        return _empty_ticker_envelope(ticker)

    articles = data.get("data", [])

    positive = 0
    negative = 0
    neutral = 0

    for article in articles:
        for entity in article.get("entities",[]):
            if entity.get("symbol") == ticker:
                sentiment = entity.get("sentiment_score")

                if sentiment is None:
                    continue

                if sentiment > 0:
                    positive += 1
                elif sentiment < 0:
                    negative += 1
                else:
                    neutral += 1

    return {
        "ticker": ticker,
        "total_articles": len(articles),
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "articles": articles
    }


@router.get("/ticker/{ticker}", response_model=TickerNewsResponse)
def get_ticker_news(ticker: str, current_user: User = Depends(get_current_user)):
    cached = _TICKER_NEWS_CACHE.get(ticker)
    if cached and time.monotonic() - cached[0] < _NEWS_TTL_SECONDS:
        return cached[1]

    envelope = _fetch_ticker_news(ticker)
    _TICKER_NEWS_CACHE[ticker] = (time.monotonic(), envelope)
    return envelope
