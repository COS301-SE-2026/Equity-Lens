from fastapi import APIRouter,Depends
import os
import requests
from dotenv import load_dotenv
from app.dependencies import get_current_user
from app.database import get_db
from app.schemas.auth import UserResponse
from sqlalchemy.orm import Session

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






