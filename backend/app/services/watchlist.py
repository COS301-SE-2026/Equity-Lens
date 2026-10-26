import logging
import time
from threading import Lock

import yfinance as yf
from fastapi import HTTPException

from app.config import settings
from app.repositories.watchlist import add_watchlist, get_watchlist, remove_watchlist
from app.schemas.responses import AppError
from app.services.market_data_service import WATCHLIST_QUOTE_TYPES, _cents_to_major
from app.utils import stock_cache

logger = logging.getLogger(__name__)

TICKER_INFO_TTL_SECONDS = 900
TICKER_INFO_MAX_KEYS = 200
_TICKER_INFO: dict[str, tuple[float, dict]] = {}
_TICKER_INFO_LOCK = Lock()


def _ticker_info(ticker: str) -> dict | None:
    now = time.monotonic()
    with _TICKER_INFO_LOCK:
        cached = _TICKER_INFO.get(ticker)
        if cached and now - cached[0] < TICKER_INFO_TTL_SECONDS:
            return cached[1]

    if stock_cache._yfinance_globally_cooling_down():
        return None

    try:
        info = yf.Ticker(ticker).info
    except Exception as exc:
        if stock_cache._is_rate_limit_error(exc):
            stock_cache._trip_yfinance_global_cooldown()
        logger.warning(f"yfinance lookup failed for {ticker}: {exc}")
        return None

    with _TICKER_INFO_LOCK:
        if len(_TICKER_INFO) >= TICKER_INFO_MAX_KEYS:
            _TICKER_INFO.pop(min(_TICKER_INFO, key=lambda k: _TICKER_INFO[k][0]))
        _TICKER_INFO[ticker] = (now, info)
    return info


def add_watchlist_service(database, user_id, data, is_guest=False):
    if is_guest and len(get_watchlist(database, user_id)) >= settings.guest_max_watchlist:
        raise AppError(
            403,
            "GUEST_LIMIT",
            f"guest sessions can watch up to {settings.guest_max_watchlist} tickers"
            " - create an account for more",
        )

    company_name = None
    sector = None
    stock_info = _ticker_info(data.ticker)

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

    add_watchlist(database, user_id, data.ticker, company_name, sector)

    return {"success": True, "Message": "Add watchlist successfully"}


def get_watchlist_service(database, user_id):
    watchlist = get_watchlist(database, user_id)

    AllResults = []

    for items in watchlist:
        current_price = None
        change_percent = None
        getInfo = _ticker_info(items.ticker)
        if getInfo:
            current_price = getInfo.get("currentPrice")
            if current_price is not None:
                current_price = current_price / _cents_to_major(items.ticker)
            change_percent = getInfo.get("regularMarketChangePercent")

        AllResults.append(
            {
                "id": items.id,
                "ticker": items.ticker,
                "company_name": items.company_name,
                "sector": items.sector,
                "current_price": current_price,
                "change_percent": change_percent,
            }
        )

    if len(AllResults) == 0:
        return {
            "success": True,
            "Message": "All the users watchlist",
            "watchlist": [],
            "highest": None,
            "lowest": None,
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
        "lowest": Thelowest,
    }


def remove_watchlist_service(database, user_id, WatchListID):
    remove_watchlist(database, user_id, WatchListID)

    return {"success": True, "Message": "Deleted watchlist successfully"}
