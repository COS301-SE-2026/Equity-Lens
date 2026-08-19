from fastapi import APIRouter,Depends
import os
import requests
from dotenv import load_dotenv
from app.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from sqlalchemy.orm import Session
from app.models.portfolio import Holdings, Portfolios
from app.schemas.auth import UserResponse

load_dotenv()

router = APIRouter(prefix="/api/news", tags=["importing news"])

@router.get("/all")
def get_news(current_user: User = Depends(get_current_user)):
    api_key=os.getenv("NEWSDATA_API_KEY")

    response = requests.get("https://newsdata.io/api/1/latest",
      params={
        "apikey": api_key,
        "language" : "en",
      },
      timeout=4,
  )

    return response.json()

@router.get("/")
def get_news(category: str="business", current_user: User = Depends(get_current_user)):
    api_key=os.getenv("NEWSDATA_API_KEY")

    response = requests.get("https://newsdata.io/api/1/latest",
      params={
        "apikey": api_key,
        "category": category,
        "language" : "en",
      },
      timeout=4,
    )


    return response.json()

@router.get("/portfolio-tickers")
def get_portfolio_tickers(
  current_user: UserResponse = Depends(get_current_user),
  db: Session = Depends(get_db),
):

  tickers = (db.query(Holdings.ticker).join(Portfolios, Holdings.portfolio_id == Portfolios.id)
              .filter(Portfolios.user_id == current_user.id, Holdings.ticker.isnot(None), Holdings.ticker != "")
              .distinct()
              .all()
            )

  return {
    "tickers": [ticker[0] for ticker in tickers]
  }

@router.get("/test-aapl/{ticker}")
def test_aapl_news(ticker: str):
    api_key = os.getenv("MARKET_API_KEY")

    response = requests.get(
        "https://api.marketaux.com/v1/news/all",
        params={
            "api_token": api_key,
            "symbols": ticker,
            "filter_entities": "true",
            "language": "en",
            "limit": 20
        },
        timeout=6,
    )

    data = response.json()

    if "error" in data:
        return data

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

