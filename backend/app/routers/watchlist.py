from fastapi import APIRouter,Depends
import os
import requests
from dotenv import load_dotenv
from app.dependencies import get_current_user
from app.database import get_db
from app.schemas.auth import UserResponse
from sqlalchemy.orm import Session
from app.schemas.watchlist import WatchListRequest
from app.services.watchlist import add_watchlist_service,get_watchlist_service,remove_watchlist_service
from pydantic import BaseModel, Field
from typing import Any

load_dotenv()

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

class WatchlistActionResponse(BaseModel):
    success: bool = Field(example=[True])
    Message: str = Field(example=["Deleted watchlist successfully"])

class WatchlistItemResponse(BaseModel):
    id: int = Field(examples=[1])
    ticker: str = Field(examples=["AAPL"])
    company_name: str = Field(examples=["AAPL Inc."])
    sector: str = Field(examples=["Business"])
    current_price: int = Field(examples=[24.5])
    change_percent: int = Field(examples=[23.5])

class WatchlisResponse(BaseModel):
    success: bool = Field(example=[True])
    Message: str = Field(example=["Add watchlist successfully"])
    watchlist: list[WatchlistItemResponse]
    highest: WatchlistItemResponse
    lowest: WatchlistItemResponse


@router.post("/", response_model=WatchlisResponse)
def add_watchlist(data:WatchListRequest, db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return add_watchlist_service(db, CurrentUser.id, data)


@router.get("/", response_model=WatchlistItemResponse)
def get_watchlist(db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_watchlist_service(db, CurrentUser.id)

@router.delete("/{watchlistID}", response_model=WatchlistActionResponse)
def remove_watchlist(watchlistID: str, db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return remove_watchlist_service(db, CurrentUser.id,watchlistID)