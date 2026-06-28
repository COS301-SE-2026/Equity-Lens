from app.repositories.import_pdf import SaveDocument
from app.repositories.import_pdf import SavePortfolios
from app.repositories.import_pdf import SaveHoldings
from app.repositories.import_pdf import SaveInstrumentPurchasesAndSales
from app.repositories.import_pdf import SaveTransactionCosts
from app.repositories.import_pdf import SaveContributionsAndWithdrawals
from app.repositories.import_pdf import SaveDividendsAndWithholdingTax
from app.repositories.import_pdf import SaveTransactionInterest
from app.repositories.import_pdf import SaveTransactionExpenses
import yfinance as yf

def searchTicketNumber(instrumentName: str):
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


def ImportPdfData(database,user_id,data):
    document = SaveDocument(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully",
        "document_id": str(document.id)
    }

def SavePortfoliosImport(database,user_id,data):
    document = SavePortfolios(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully",
        "portfolio_id": str(document.id)
    }

def SaveHoldingsImport(database,user_id,data):
    ticker = searchTicketNumber(data.instrument_name)
    document = SaveHoldings(database,user_id,data,ticker["ticker"])

    return {
        "Success": True,
        "Message": "Holdings has been saved successfully"
    }


def SaveInstrumentPurchasesAndSalesImport(database,user_id,data):
    document = SaveInstrumentPurchasesAndSales(database,user_id,data)

    return {
        "Success": True,
        "Message": "Instrument purchase and sales has been saved successfully"
    }


def SaveTransactionCostsImport(database,user_id,data):
    document = SaveTransactionCosts(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction costs has been saved successfully"
    }


def SaveContributionsAndWithdrawalsImport(database,user_id,data):
    document = SaveContributionsAndWithdrawals(database,user_id,data)

    return {
        "Success": True,
        "Message": "Contributions and withdrawals has been saved successfully"
    }


def SaveDividendsAndWithholdingTaxImport(database,user_id,data):
    document = SaveDividendsAndWithholdingTax(database,user_id,data)

    return {
        "Success": True,
        "Message": "Dividends and withholding tax import has been saved successfully"
    }


def SaveTransactionInterestImport(database,user_id,data):
    document = SaveTransactionInterest(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction interest has been saved successfully"
    }


def SaveTransactionExpensesImport(database,user_id,data):
    document = SaveTransactionExpenses(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction expenses has been saved successfully"
    }

