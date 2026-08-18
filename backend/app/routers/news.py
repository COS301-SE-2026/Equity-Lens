from fastapi import APIRouter,Depends
import os
import requests
from dotenv import load_dotenv
from app.dependencies import get_current_user
from app.database import get_db
from app.schemas.auth import UserResponse
from sqlalchemy.orm import Session
from app.models.portfolio import Holdings, Portfolios

load_dotenv()

router = APIRouter(prefix="/api/news", tags=["importing news"])

@router.get("/all")
def get_news():
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
def get_news(category: str="business"):
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




