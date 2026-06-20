import uuid
from app.models.portfolio import Document
from app.models.portfolio import portfolios
from app.models.portfolio import holdings
from app.models.portfolio import Instrument_Purchases_and_Sales
from app.models.portfolio import Transaction_Costs
from app.models.portfolio import Contributions_and_Withdrawals
from app.models.portfolio import Dividends_and_Withholding_Tax
from app.models.portfolio import transaction_Interest
from app.models.portfolio import transaction_Expenses


def save_document(database,user_id,data):

    saving = Document(
        user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        file_name = data.file_name,
        encrypted_file_path = "Frontend",
        encrypted_document_text = data.document_text,
        extracted_password = data.password

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_portfolios(database,user_id,data):

    saving = portfolios(
        user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        document_id = data.document_id,
        account_number = data.account_number,
        portfolio_name = data.portfolio_name,

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_holdings(database,user_id,data):

    saving = holdings(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        instrument_name = data.instrument_name,
        portfolio_id = data.portfolio_id,
        quantity = data.quantity,
        total_cost = data.total_cost,
        cost_price = data.cost_price,
        current_price = data.current_price,
        current_value = data.current_value,
        weight_percentage = data.weight_percentage

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_Instrument_Purchases_and_Sales(database,user_id,data):

    saving = Instrument_Purchases_and_Sales(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transactions_date = data.transactions_date,
        transaction_type_id = data.transaction_type_id,
        instrument_type_id = data.instrument_type_id,
        price = data.price,
        quantity = data.quantity,
        transactions_cost = data.transactions_cost,
        Value_Zar = data.Value_Zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_Transaction_Costs(database,user_id,data):

    saving = Transaction_Costs(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_type_id = data.transaction_type_id,
        Brokerage = data.Brokerage,
        Other_Trading_Costs = data.Other_Trading_Costs

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_Contributions_and_Withdrawals(database,user_id,data):

    saving = Contributions_and_Withdrawals(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        Settlement_Date = data.Settlement_Date,
        transaction_type_id = data.transaction_type_id,
        value_ZAR = data.value_ZAR


    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_Dividends_and_Withholding_Tax(database,user_id,data):

    saving = Dividends_and_Withholding_Tax(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        instrument_type_id = data.instrument_type_id,
        Gross_dividend = data.Gross_dividend,
        Withholding_tax = data.Withholding_tax,
        Net_dividend = data.Net_dividend,
        Tax_rate = data.Tax_rate

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_transaction_Interest(database,user_id,data):

    saving = transaction_Interest(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        Settlement_Date = data.Settlement_Date,
        transaction_type_id = data.transaction_type_id,
        instrument_type_id = data.instrument_type_id,
        value_ZAR = data.value_ZAR

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_transaction_Expenses(database,user_id,data):

    saving = transaction_Expenses(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        Settlement_Date = data.Settlement_Date,
        transaction_type_id = data.transaction_type_id,
        narrative = data.narrative,
        value_ZAR = data.value_ZAR

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving



