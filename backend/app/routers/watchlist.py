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

load_dotenv()

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

@router.post("/")
def add_watchlist(data:WatchListRequest, db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return add_watchlist_service(db, CurrentUser.id, data)


@router.get("/")
def get_watchlist(db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_watchlist_service(db, CurrentUser.id)

@router.delete("/{watchlistID}")
def remove_watchlist(watchlistID: str, db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return remove_watchlist_service(db, CurrentUser.id,watchlistID)