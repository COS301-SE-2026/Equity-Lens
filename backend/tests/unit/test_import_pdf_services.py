from unittest.mock import Mock, patch

from app.services.import_pdf import search_ticket_number
from app.services.import_pdf import _search_ticker_number_uncached
from app.services.import_pdf import search_queries
from app.services.import_pdf import import_Pdf_data
from app.services.import_pdf import save_portfolios_import
from app.services.import_pdf import get_my_portfolio
from app.services.import_pdf import save_holdings_import
from app.services.import_pdf import save_instrument_purchases_and_sales_import
from app.services.import_pdf import save_contributions_and_withdrawals_import
from app.services.import_pdf import save_dividends_and_withholding_tax_import
from app.services.import_pdf import save_transaction_expenses_import

@patch("app.services.import_pdf.save_document")
def test_import_Pdf_data(mock_data):
    Document = Mock()
    Document.id = 10

    mock_data.return_value = Document

    result =  import_Pdf_data(
        database=Mock(),
        user_id=4,
        data=Mock(),
    )

    assert result["Success"] is True
    assert result["Message"] == "PDF has been saved successfully"
    assert result["document_id"] == "10"


@patch("app.services.import_pdf.save_holdings")
@patch("app.services.import_pdf.search_ticket_number")
def test_save_holdings_import(mock_search, mock_data):
    mock_search.return_value = {
        "ticker" : "AAPL",
        "sector": "Tech"
    }

    mock_data.return_value = Mock()

    result =  save_holdings_import(
        database=Mock(),
        user_id=4,
        data=Mock(),
    )

    assert result["Success"] is True
    assert result["Message"] == "Holdings has been saved successfully"


@patch("app.services.import_pdf.save_instrument_purchases_and_sales")
@patch("app.services.import_pdf.search_ticket_number")
def test_save_instrument_purchases_and_sales_import(mock_search, mock_data):
    mock_search.return_value = {
        "ticker" : "AAPL",
        "sector": "Tech"
    }

    mock_data.return_value = Mock()

    result =  save_instrument_purchases_and_sales_import(
        database=Mock(),
        user_id=4,
        data=Mock(),
    )

    assert result["Success"] is True
    assert result["Message"] == "Instrument purchase and sales has been saved successfully"

@patch("app.services.import_pdf.save_contributions_and_withdrawals")
@patch("app.services.import_pdf.search_ticket_number")
def test_save_contributions_and_withdrawals_import(mock_search, mock_data):
    mock_search.return_value = {
        "ticker" : "AAPL",
        "sector": "Tech"
    }

    mock_data.return_value = Mock()

    result =  save_contributions_and_withdrawals_import(
        database=Mock(),
        user_id=4,
        data=Mock(),
    )

    assert result["Success"] is True
    assert result["Message"] == "Contributions and withdrawals has been saved successfully"

@patch("app.services.import_pdf.save_dividends_and_withholding_tax")
@patch("app.services.import_pdf.search_ticket_number")
def test_save_dividends_and_withholding_tax_import(mock_search,mock_data):
    mock_search.return_value = {
        "ticker" : "AAPL",
        "sector": "Tech"
    }

    mock_data.return_value = Mock()
    data = Mock()
    data.instrument_name = "Apple"

    result =  save_dividends_and_withholding_tax_import(
        database=Mock(),
        user_id=4,
        data=data,
    )

    assert result["Success"] is True
    assert result["Message"] == "Dividends and withholding tax import has been saved successfully"

@patch("app.services.import_pdf.save_transaction_expenses")
def test_save_transaction_expenses_import(mock_data):
    mock_data.return_value = Mock()

    result =  save_transaction_expenses_import(
        database=Mock(),
        user_id=4,
        data=Mock(),
    )

    assert result["Success"] is True
    assert result["Message"] == "Transaction expenses has been saved successfully"
