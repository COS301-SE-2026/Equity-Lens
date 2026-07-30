from app.repositories.import_pdf import save_document
from app.repositories.import_pdf import save_portfolios
from app.repositories.import_pdf import save_holdings
from app.repositories.import_pdf import save_instrument_purchases_and_sales
from app.repositories.import_pdf import save_contributions_and_withdrawals
from app.repositories.import_pdf import save_dividends_and_withholding_tax
from app.repositories.import_pdf import save_transaction_expenses
import yfinance as yf
import re
from yfinance.exceptions import YFRateLimitError
import time
from app.repositories.import_pdf import get_latest_portfolio, save_portfolios
# from app.services.instrument import resolve_known_instrument
from requests.exceptions import ReadTimeout

SECONDS_In_HOUR = 3600
Cache: dict[str, tuple[float, dict]] = {}

# def search_ticket_number(instrumentName: str):
#     The_Keys = instrumentName.strip().lower()

#     TheKnownsOne = resolve_known_instrument(instrumentName)

#     if TheKnownsOne:
#         return {"Found": True, "ticker":TheKnownsOne.ticker, "sector":TheKnownsOne.sector}


def search_ticket_number(instrumentName: str):
    
    The_Keys = instrumentName.strip().lower()
    cached = Cache.get(The_Keys)

    if cached and (time.time() - cached[0]) < SECONDS_In_HOUR:
        return cached[1]

    result = _search_ticker_number_uncached(instrumentName)

    if not result["Found"]:
        time.sleep(2)
        result = _search_ticker_number_uncached(instrumentName)
    
    if result["Found"]:
        Cache[The_Keys] = (time.time(), result)
    
    return result


def _search_ticker_number_uncached(instrument_name: str):
    try:
        query = search_queries(instrument_name)
        quotes = yf.Search(query).quotes
            
        if not quotes:
            return{
                "Found": False,
                "ticker": "none",
                "sector": "none",
            }
        
        gettingTicker = quotes[0]["symbol"]
        gettingTheInfo = yf.Ticker(gettingTicker).info

        if(quotes[0].get("quoteType") or "").upper() == "ETF":
            category = gettingTheInfo.get("category") 
            return {
                "Found": True,
                "ticker": gettingTicker,
                "sector": category,
            }

        return {
            "Found": True,
            "ticker": gettingTicker,
            "sector": gettingTheInfo.get("sector") or "none",

        }
    
    except YFRateLimitError as exc:
        return {
            "Found": False,
            "ticker": "none",
            "sector": "none",
        }

    except ReadTimeout as exc:
        return {
            "Found": False,
            "ticker": "none",
            "sector": "none",
        }

def search_queries(instrumentName):
    gettingName = " ".join(instrumentName.split())

    trimmed = re.sub("ETF","",gettingName,flags=re.IGNORECASE)
    trimmed = trimmed.strip()

    if trimmed != gettingName:
        return trimmed
    
    return gettingName

def import_Pdf_data(database,user_id,data):
    document = save_document(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully",
        "document_id": str(document.id)
    }

def save_portfolios_import(database,user_id,data):
    document = save_portfolios(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully",
        "portfolio_id": str(document.id)
    }

def get_my_portfolio(database, user_id):
    document = get_latest_portfolio(database, user_id)

    if not document:
        return {
            "Found": False,
            "portfolio_id": None
        }

    return {
        "Found": True,
        "portfolio_id": str(document.id)
    }

def save_holdings_import(database,user_id,data):
    ticker = search_ticket_number(data.instrument_name)
    document = save_holdings(database,user_id,data,ticker["ticker"],ticker["sector"])

    return {
        "Success": True,
        "Message": "Holdings has been saved successfully"
    }


def save_instrument_purchases_and_sales_import(database,user_id,data):
    ticker = search_ticket_number(data.instrument_name)
    document = save_instrument_purchases_and_sales(database,user_id,data,ticker["ticker"],ticker["sector"])

    return {
        "Success": True,
        "Message": "Instrument purchase and sales has been saved successfully"
    }


def save_contributions_and_withdrawals_import(database,user_id,data):
    document = save_contributions_and_withdrawals(database,user_id,data)

    return {
        "Success": True,
        "Message": "Contributions and withdrawals has been saved successfully"
    }


def save_dividends_and_withholding_tax_import(database,user_id,data):
    ticker = search_ticket_number(data.instrument_name)
    document = save_dividends_and_withholding_tax(database,user_id,data,ticker["ticker"],ticker["sector"])

    return {
        "Success": True,
        "Message": "Dividends and withholding tax import has been saved successfully"
    }


def save_transaction_expenses_import(database,user_id,data):
    document = save_transaction_expenses(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction expenses has been saved successfully"
    }

