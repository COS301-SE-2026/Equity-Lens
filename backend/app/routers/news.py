from fastapi import APIRouter
import requests
import os

router = APIRouter()

API_KEY_from_The_Env = os.getenv("NEWS_API_KEY")

@router.get("/news")
def get_news():
    theapicall = (
        f"https://newsapi.org/v2/top-headlines"
        f"?category=business"
        f"&language=en"
        f"&apiKey={API_KEY_from_The_Env}"
    )

    gettingtheResponse = requests.get(theapicall)

    return gettingtheResponse.json()