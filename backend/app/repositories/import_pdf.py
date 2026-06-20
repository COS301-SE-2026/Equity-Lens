import uuid
from app.models.portfolio import Document
from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings
from app.models.portfolio import InstrumentPurchasesAndSales
from app.models.portfolio import TransactionCosts
from app.models.portfolio import ContributionsAndWithdrawals
from app.models.portfolio import DividendsAndWithholdingTax
from app.models.portfolio import TransactionInterest
from app.models.portfolio import TransactionExpenses


def SaveDocument(database,user_id,data):

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

def SavePortfolios(database,user_id,data):

    saving = Portfolios(
        user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        document_id = data.document_id,
        account_number = data.account_number,
        portfolio_name = data.portfolio_name,

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveHoldings(database,user_id,data):

    saving = Holdings(
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

def SaveInstrumentPurchasesAndSales(database,user_id,data):

    saving = InstrumentPurchasesAndSales(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transactions_date = data.transactions_date,
        transaction_type_id = data.transaction_type_id,
        instrument_type_id = data.instrument_type_id,
        price = data.price,
        quantity = data.quantity,
        transactions_cost = data.transactions_cost,
        value_zar = data.value_zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveTransactionCosts(database,user_id,data):

    saving = TransactionCosts(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_type_id = data.transaction_type_id,
        brokerage = data.brokerage,
        other_trading_costs = data.other_trading_costs

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveContributionsAndWithdrawals(database,user_id,data):

    saving = ContributionsAndWithdrawals(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        settlement_date = data.settlement_date,
        transaction_type_id = data.transaction_type_id,
        value_zar = data.value_zar


    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveDividendsAndWithholdingTax(database,user_id,data):

    saving = DividendsAndWithholdingTax(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        instrument_type_id = data.instrument_type_id,
        gross_dividend = data.gross_dividend,
        withholding_tax = data.withholding_tax,
        net_dividend = data.net_dividend,
        tax_rate = data.tax_rate

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveTransactionInterest(database,user_id,data):

    saving = TransactionInterest(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        settlement_date = data.settlement_date,
        transaction_type_id = data.transaction_type_id,
        instrument_type_id = data.instrument_type_id,
        value_zar = data.value_zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def SaveTransactionExpenses(database,user_id,data):

    saving = TransactionExpenses(
        # user_id = "ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        settlement_date = data.settlement_date,
        transaction_type_id = data.transaction_type_id,
        narrative = data.narrative,
        value_zar = data.value_zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving



