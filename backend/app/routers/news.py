from fastapi import APIRouter
import os
import requests
from dotenv import load_dotenv

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