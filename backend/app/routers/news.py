from fastapi import APIRouter,Depends
import os
import requests
from dotenv import load_dotenv
from app.dependencies import get_current_user
from app.database import get_db
from app.schemas.auth import UserResponse
from sqlalchemy.orm import Session

from app.services.news_service import get_portfolio_new,clean_instrument_news

load_dotenv()

router = APIRouter(prefix="/news", tags=["importing news"])

@router.get("/")
def get_news(parameter: str="JSE"):
    api_key=os.getenv("NEWSDATA_API_KEY")

    response = requests.get("https://newsdata.io/api/1/latest",
      params={
        "apikey": api_key,
        "q": parameter
      })


    return response.json()


@router.get("/portfolio_news")
def get_portfolio_news(db: Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    api_key=os.getenv("NEWSDATA_API_KEY")

    offunction = get_portfolio_new(db = db, CurrentUser = CurrentUser)

    response = requests.get("https://newsdata.io/api/1/latest",
      params={
        "apikey": api_key,
        "q": offunction
      })

    return response.json()

@router.get("/market_snapshot")
def get_market_snapshot():
  api_key=os.getenv("MARKETSTACK_API_KEY")

  response = requests.get("https://api.marketstack.com/v1/eod/latest",
    params={"access_key":api_key, "symbols" : "AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,NFLX,AMD,INTC,ORCL,IBM,CRM,ADBE,CSCO,QCOM,AVGO,PEP,KO,DIS,UBER,PYPL,COST,WMT,BA,BE,JPM"})

  return response.json()





