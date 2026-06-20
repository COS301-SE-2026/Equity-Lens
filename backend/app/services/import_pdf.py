from app.repositories.import_pdf import save_document
from app.repositories.import_pdf import save_portfolios
from app.repositories.import_pdf import save_holdings
from app.repositories.import_pdf import save_Instrument_Purchases_and_Sales
from app.repositories.import_pdf import save_Transaction_Costs
from app.repositories.import_pdf import save_Contributions_and_Withdrawals
from app.repositories.import_pdf import save_Dividends_and_Withholding_Tax
from app.repositories.import_pdf import save_transaction_Interest
from app.repositories.import_pdf import save_transaction_Expenses

def import_pdf_data(database,user_id,data):
    document = save_document(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully"
    }

def save_portfolios_Import(database,user_id,data):
    document = save_portfolios(database,user_id,data)

    return {
        "Success": True,
        "Message": "PDF has been saved successfully"
    }

def save_holdings_Import(database,user_id,data):
    document = save_holdings(database,user_id,data)

    return {
        "Success": True,
        "Message": "Holdings has been saved successfully"
    }


def save_Instrument_Purchases_and_Sales_Import(database,user_id,data):
    document = save_Instrument_Purchases_and_Sales(database,user_id,data)

    return {
        "Success": True,
        "Message": "Instrument purchase and sales has been saved successfully"
    }


def save_Transaction_Costs_Import(database,user_id,data):
    document = save_Transaction_Costs(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction costs has been saved successfully"
    }


def save_Contributions_and_Withdrawals_Import(database,user_id,data):
    document = save_Contributions_and_Withdrawals(database,user_id,data)

    return {
        "Success": True,
        "Message": "Contributions and withdrawals has been saved successfully"
    }


def save_Dividends_and_Withholding_Tax_Import(database,user_id,data):
    document = save_Dividends_and_Withholding_Tax(database,user_id,data)

    return {
        "Success": True,
        "Message": "Dividends and withholding tax import has been saved successfully"
    }


def save_transaction_Interest_Import(database,user_id,data):
    document = save_transaction_Interest(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction interest has been saved successfully"
    }


def save_transaction_Expenses_Import(database,user_id,data):
    document = save_transaction_Expenses(database,user_id,data)

    return {
        "Success": True,
        "Message": "Transaction expenses has been saved successfully"
    }

