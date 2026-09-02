
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.portfolio import Document
from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings
from app.models.portfolio import InstrumentPurchasesAndSales
from app.models.portfolio import ContributionsAndWithdrawals
from app.models.portfolio import DividendsAndWithholdingTax
from app.models.portfolio import TransactionExpenses

from app.repositories.import_pdf import save_document
from app.repositories.import_pdf import save_portfolios
from app.repositories.import_pdf import save_holdings
from app.repositories.import_pdf import get_latest_portfolio
from app.repositories.import_pdf import save_instrument_purchases_and_sales
from app.repositories.import_pdf import save_contributions_and_withdrawals
from app.repositories.import_pdf import save_dividends_and_withholding_tax
from app.repositories.import_pdf import save_transaction_expenses



def test_save_document():

    theDatabase = MagicMock()

    dataFile = SimpleNamespace(file_name="testAPdf.pdf")

    result = save_document(
        database=theDatabase,
        user_id = "userOne",
        data = dataFile,
    )

    assert isinstance(result, Document)
    assert result.user_id == "userOne"

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)

def test_save_portfolios():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        document_id = "DocumentID",
        account_number = "EE154",
        portfolio_name = "SouthAfrica",
        currency = "ZAR",
        statement_start_date="2024-01-01",
        statement_end_date="2024-12-31",
        account_type="TFSA",
    )

    result = save_portfolios(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
    )

    assert isinstance(result, Portfolios)
    assert result.user_id == "userOne"

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)


def test_save_holdings():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        instrument_name = "Apple",
        portfolio_id = "PortfolioID",
        quantity = 15,
        total_cost = 20,
        cost_price = 30,
        weight_percentage = 24
    )

    result = save_holdings(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
        ticker = "testTicker",
        sector = "testSector"
    )


    assert isinstance(result, Holdings)
    assert result.instrument_name == "Apple"
    assert result.portfolio_id == "PortfolioID"
    assert result.quantity == 15
    assert result.total_cost == 20
    assert result.cost_price == 30
    assert result.weight_percentage == 24
    assert result.ticker == "testTicker"
    assert result.sector == "testSector"

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)


def test_save_instrument_purchases_and_sales():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        portfolio_id = "PortfolioID",
        transaction_date = date(2026,6,7),
        transaction_name = "Sales",
        instrument_name = "Apple",
        price = 1500,
        quantity = 5,
        value_zar = 7500
    )

    result = save_instrument_purchases_and_sales(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
        ticker = "testTicker",
        sector = "testSector"
    )

    assert isinstance(result, InstrumentPurchasesAndSales)
    assert result.portfolio_id == "PortfolioID"
    assert result.transaction_date == date(2026,6,7)
    assert result.transaction_name == "Sales"
    assert result.instrument_name == "Apple"
    assert result.price == 1500
    assert result.quantity == 5
    assert result.value_zar == 7500
    assert result.ticker == "testTicker"
    assert result.sector == "testSector"

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)


def test_save_contributions_and_withdrawals():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        portfolio_id = "PortfolioID",
        transaction_date = date(2026,6,7),
        settlement_date = date(2026,6,7),
        transaction_name = "Capital",
        value_zar = 50

    )

    result = save_contributions_and_withdrawals(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
    )

    assert isinstance(result, ContributionsAndWithdrawals)
    assert result.portfolio_id == "PortfolioID"
    assert result.transaction_date == date(2026,6,7)
    assert result.settlement_date == date(2026,6,7)
    assert result.transaction_name == "Capital"
    assert result.value_zar == 50

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)


def test_save_dividends_and_withholding_tax():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        portfolio_id = "PortfolioID",
        transaction_date = date(2026,6,7),
        instrument_name = "APPLE",
        gross_dividend = 100,
        withholding_tax = 50,
        net_dividend = 40,
        tax_rate = 70,

    )

    result = save_dividends_and_withholding_tax(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
        ticker = "tickerTest",
        sector = "sectorTest"
    )

    assert isinstance(result, DividendsAndWithholdingTax)
    assert result.portfolio_id == "PortfolioID"
    assert result.transaction_date == date(2026,6,7)
    assert result.instrument_name == "APPLE"
    assert result.gross_dividend == 100
    assert result.withholding_tax == 50
    assert result.net_dividend == 40
    assert result.tax_rate == 70
    assert result.ticker == "tickerTest"
    assert result.sector == "sectorTest"

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)

def test_save_transaction_expenses():

    theDatabase = MagicMock()

    TheData = SimpleNamespace(
        portfolio_id = "PortfolioID",
        transaction_date = date(2026,6,7),
        settlement_date = date(2026,6,7),
        narrative_name = "Capital",
        value_zar = 50

    )

    result = save_transaction_expenses(
        database=theDatabase,
        user_id = "userOne",
        data = TheData,
    )

    assert isinstance(result, TransactionExpenses)
    assert result.portfolio_id == "PortfolioID"
    assert result.transaction_date == date(2026,6,7)
    assert result.settlement_date == date(2026,6,7)
    assert result.narrative_name == "Capital"
    assert result.value_zar == 50

    theDatabase.add.assert_called_once_with(result)
    theDatabase.commit.assert_called_once()
    theDatabase.refresh.assert_called_once_with(result)





