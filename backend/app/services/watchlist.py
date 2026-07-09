import yfinance as yf

from app.repositories.watchlist import add_watchlist,get_watchlist,remove_watchlist

def add_watchlist_service(database,user_id,data):
    add_watchlist(database,user_id,data)

    return {
        "success": True,
        "Message": "Add watchlist successfully"
    }

def get_watchlist_service(database,user_id):
    watchlist = get_watchlist(database,user_id)

    AllResults = []

    for items in watchlist:
        getInfo = yf.Ticker(items.ticker).info

        AllResults.append({
            "id": items.id,
            "ticker": items.ticker,
            "company_name": items.company_name,
            "sector": items.sector,
            "current_price": getInfo.get("currentPrice"),
            "change_percent": getInfo.get("regularMarketChangePercent"),

        })

    TheHighest = AllResults[0]
    Thelowest = AllResults[0]

    for items in AllResults:
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