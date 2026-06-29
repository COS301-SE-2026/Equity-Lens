from app.repositories.import_pdf import save_document
from app.repositories.import_pdf import save_portfolios
from app.repositories.import_pdf import save_holdings
from app.repositories.import_pdf import save_instrument_purchases_and_sales
from app.repositories.import_pdf import save_transaction_costs
from app.repositories.import_pdf import save_contributions_and_withdrawals
from app.repositories.import_pdf import save_dividends_and_withholding_tax
from app.repositories.import_pdf import save_transaction_interest
from app.repositories.import_pdf import save_transaction_expenses
import yfinance as yf

def search_ticket_number(instrumentName: str):
    instrumentName = instrumentName.replace("South Africa","SA")
    instrumentName = instrumentName.replace("Exchange Traded Fund","")
    instrumentName = instrumentName.replace("Index","")
    
    search = yf.Search(instrumentName)
    gettingName = search.quotes

    if not gettingName:
        return { "Found": False, "ticker": "none", "sector": "none" }

    ticker = gettingName[0]["symbol"]
    sector = yf.Ticker(ticker).info.get("sector")

    if not sector:
        return { "Found": True, "ticker": gettingName[0]["symbol"], "sector": "none" }
    else:
        return { "Found": True, "ticker": gettingName[0]["symbol"], "sector": sector }


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

def save_holdings_import(database,user_id,data):
    ticker = search_ticket_number(data.instrument_name)
    document = save_holdings(database,user_id,data,ticker["ticker"])

    return {
        "Success": True,
        "Message": "Holdings has been saved successfully"
    }


def save_instrument_purchases_and_sales_import(database,user_id,data):
    document = save_instrument_purchases_and_sales(database,user_id,data)

    return {
        "Success": True,
        "Message": "Instrument purchase and sales has been saved successfully"
    }


def save_transaction_costs_import(database,user_id,data):
    document = save_transaction_costs(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction costs has been saved successfully"
    }


def save_contributions_and_withdrawals_import(database,user_id,data):
    document = save_contributions_and_withdrawals(database,user_id,data)

    return {
        "Success": True,
        "Message": "Contributions and withdrawals has been saved successfully"
    }


def save_dividends_and_withholding_tax_import(database,user_id,data):
    document = save_dividends_and_withholding_tax(database,user_id,data)

    return {
        "Success": True,
        "Message": "Dividends and withholding tax import has been saved successfully"
    }


def save_transaction_interest_import(database,user_id,data):
    document = save_transaction_interest(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction interest has been saved successfully"
    }


def save_transaction_expenses_import(database,user_id,data):
    document = save_transaction_expenses(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction expenses has been saved successfully"
    }

