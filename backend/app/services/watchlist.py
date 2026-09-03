import logging

from fastapi import HTTPException
import yfinance as yf

from app.repositories.watchlist import add_watchlist,get_watchlist,remove_watchlist
from app.services.market_data_service import _cents_to_major, WATCHLIST_QUOTE_TYPES

logger = logging.getLogger(__name__)

def add_watchlist_service(database,user_id,data):
    company_name = None
    sector = None
    stock_info = None
    try:
        stock_info = yf.Ticker(data.ticker).info
    except Exception as exc:
        logger.warning(f"yfinance lookup failed for {data.ticker}: {exc}")

    if stock_info:
        quote_type = stock_info.get("quoteType")
        if quote_type and quote_type not in WATCHLIST_QUOTE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"{data.ticker} is a {quote_type.lower()}, not a stock, ETF, or index, "
                       "so it can't be priced or displayed here.",
            )
        company_name = stock_info.get("longName")
        sector = stock_info.get("sector")

    add_watchlist(database,user_id,data.ticker,company_name,sector)

    return {
        "success": True,
        "Message": "Add watchlist successfully"
    }

def get_watchlist_service(database,user_id):
    watchlist = get_watchlist(database,user_id)

    AllResults = []

    for items in watchlist:
        current_price = None
        change_percent = None
        try:
            getInfo = yf.Ticker(items.ticker).info
            current_price = getInfo.get("currentPrice")
            if current_price is not None:
                current_price = current_price / _cents_to_major(items.ticker)
            change_percent = getInfo.get("regularMarketChangePercent")
        except Exception as exc:
            logger.warning(f"yfinance lookup failed for {items.ticker}: {exc}")

        AllResults.append({
            "id": items.id,
            "ticker": items.ticker,
            "company_name": items.company_name,
            "sector": items.sector,
            "current_price": current_price,
            "change_percent": change_percent,
        })

    if len(AllResults) == 0:
        return{
            "success": True,
            "Message": "All the users watchlist",
            "watchlist": [],
            "highest": None,
            "lowest": None
        }

    Priced = [items for items in AllResults if items["change_percent"] is not None]

    TheHighest = Priced[0] if Priced else None
    Thelowest = Priced[0] if Priced else None

    for items in Priced:
        if items["change_percent"] > TheHighest["change_percent"]:
            TheHighest = items

        if items["change_percent"] < Thelowest["change_percent"]:
            Thelowest = items

    return {
        "success": True,
        "Message": "All the users watchlist",
        "watchlist": AllResults,
        "highest": TheHighest,
        "lowest": Thelowest
    }

def remove_watchlist_service(database,user_id,WatchListID):
    remove_watchlist(database,user_id,WatchListID)

    return {
        "success": True,
        "Message": "Deleted watchlist successfully"
    }