import uuid
from app.models.portfolio import Document
from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings
from app.models.portfolio import InstrumentPurchasesAndSales
from app.models.portfolio import ContributionsAndWithdrawals
from app.models.portfolio import DividendsAndWithholdingTax
from app.models.portfolio import TransactionExpenses
from fastapi import HTTPException

from app.schemas.portfolio import ACCOUNT_TYPE_CURRENCY


def checkDocumentID(database,document_id, user_id):
    document = database.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="The document is not found"
        )

def delete_portfolio(database,user_id,portfolio_id):
    portfolio = database.query(Portfolios).filter(Portfolios.id == portfolio_id, Portfolios.user_id == user_id).first()

    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail="The portfolio is not found"
        )
    database.delete(portfolio)
    database.commit()
def save_document(database,user_id,data):

    saving = Document(
        user_id = user_id,
        file_name = data.file_name,
    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_portfolios(database,user_id,data):
    checkDocumentID(database, data.document_id, user_id)
    saving = Portfolios(
        user_id = user_id,
        document_id = data.document_id,
        account_number = data.account_number,
        portfolio_name = data.portfolio_name,
        currency = ACCOUNT_TYPE_CURRENCY[data.account_type],
        statement_start_date = data.statement_start_date,
        statement_end_date = data.statement_end_date,
        account_type = data.account_type
    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def get_latest_portfolio(database,user_id):
    return (
        database.query(Portfolios)
        .filter(Portfolios.user_id == user_id)
        .order_by(Portfolios.created_at.desc())
        .first()
    )

def save_holdings(database,user_id,data,ticker,sector):

    saving = Holdings(
        instrument_name = data.instrument_name,
        portfolio_id = data.portfolio_id,
        ticker = ticker,
        sector = sector,
        quantity = data.quantity,
        total_cost = data.total_cost,
        cost_price = data.cost_price,
        weight_percentage = data.weight_percentage,
        statement_price = data.statement_price,
        statement_value = data.statement_value

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_instrument_purchases_and_sales(database,user_id,data,ticker,sector):

    saving = InstrumentPurchasesAndSales(
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        transaction_name = data.transaction_name,
        instrument_name = data.instrument_name,
        ticker = ticker,
        sector = sector,
        price = data.price,
        quantity = data.quantity,
        value_zar = data.value_zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_contributions_and_withdrawals(database,user_id,data):

    saving = ContributionsAndWithdrawals(
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        settlement_date = data.settlement_date,
        transaction_name = data.transaction_name,
        value_zar = data.value_zar


    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_dividends_and_withholding_tax(database,user_id,data,ticker,sector):

    saving = DividendsAndWithholdingTax(
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        instrument_name = data.instrument_name,
        ticker = ticker,
        sector = sector,
        gross_dividend = data.gross_dividend,
        withholding_tax = data.withholding_tax,
        net_dividend = data.net_dividend,
        tax_rate = data.tax_rate

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def save_transaction_expenses(database,user_id,data):

    saving = TransactionExpenses(
        portfolio_id = data.portfolio_id,
        transaction_date = data.transaction_date,
        settlement_date = data.settlement_date,
        narrative_name = data.narrative_name,
        value_zar = data.value_zar

    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving




