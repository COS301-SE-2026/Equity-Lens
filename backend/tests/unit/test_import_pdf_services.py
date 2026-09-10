from unittest.mock import Mock, patch

import pytest

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

import app.services.import_pdf as import_pdf_service


@pytest.fixture(autouse=True)
def _clear_ticker_cache():
    import_pdf_service.Cache.clear()
    yield
    import_pdf_service.Cache.clear()


@patch("app.services.import_pdf.time.sleep")
@patch("app.services.import_pdf._search_ticker_number_uncached")
def test_a_definitive_miss_is_cached_and_not_retried(mock_lookup, mock_sleep):
    mock_lookup.return_value = {
        "Found": False, "ticker": "none", "sector": "none", "Transient": False,
    }

    first = import_pdf_service.search_ticket_number("Some Unlisted Thing")
    second = import_pdf_service.search_ticket_number("Some Unlisted Thing")

    assert first["Found"] is False
    assert second["Found"] is False
    assert mock_lookup.call_count == 1
    mock_sleep.assert_not_called()


@patch("app.services.import_pdf.time.sleep")
@patch("app.services.import_pdf._search_ticker_number_uncached")
def test_a_transient_failure_is_still_retried_once(mock_lookup, mock_sleep):
    mock_lookup.side_effect = [
        {"Found": False, "ticker": "none", "sector": "none", "Transient": True},
        {"Found": True, "ticker": "AAPL", "sector": "Technology"},
    ]

    result = import_pdf_service.search_ticket_number("Apple Inc")

    assert result["ticker"] == "AAPL"
    assert mock_lookup.call_count == 2
    mock_sleep.assert_called_once()


@patch("app.services.import_pdf._search_ticker_number_uncached")
def test_a_successful_lookup_is_reused_for_later_rows(mock_lookup):
    mock_lookup.return_value = {"Found": True, "ticker": "AAPL", "sector": "Technology"}

    import_pdf_service.search_ticket_number("Apple Inc")
    import_pdf_service.search_ticket_number("apple inc")

    assert mock_lookup.call_count == 1


@patch("app.services.import_pdf._search_ticker_number_uncached")
def test_a_known_instrument_never_reaches_the_live_lookup(mock_lookup):
    result = import_pdf_service.search_ticket_number("Naspers Limited")

    assert result["ticker"] == "NPN.JO"
    mock_lookup.assert_not_called()


@patch("app.services.import_pdf.invalidate_priced_holdings")
@patch("app.services.import_pdf.save_holdings")
@patch("app.services.import_pdf.search_ticket_number")
def test_saving_a_holding_invalidates_the_priced_holdings_cache(
    mock_search, mock_save, mock_invalidate
):
    mock_search.return_value = {"ticker": "AAPL", "sector": "Tech"}
    mock_save.return_value = Mock()

    save_holdings_import(database=Mock(), user_id=4, data=Mock())

    mock_invalidate.assert_called_once_with(4)
