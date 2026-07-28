from unittest.mock import Mock,patch

from app.services.watchlist import add_watchlist_service
from app.services.watchlist import get_watchlist_service
from app.services.watchlist import remove_watchlist_service


@patch("app.services.watchlist.add_watchlist")
@patch("app.services.watchlist.yf.Ticker")
def test_add_watchlist_service(mock_ticker, mock_data):
    mock_ticker.return_value.info = {
        "longName": "Apple",
        "sector": "Tec"
    }

    data = Mock()
    data.ticker = "AAPL"

    result = add_watchlist_service(Mock(),1,data)

    assert result["success"] is True
    assert result["Message"] == "Add watchlist successfully"

@patch("app.services.watchlist.get_watchlist")
@patch("app.services.watchlist.yf.Ticker")
def test_add_watchlist_service(mock_ticker, mock_data):
    item = Mock()
    item.id = 1
    item.ticker = "AAPL"
    item.company_name = "APPLE"
    item.sector = "Tec"

    mock_data.return_value = [item]

    mock_ticker.return_value.info = {
        "currentPrice": 200,
        "regularMarketChangePercent": 5
    }

    result = get_watchlist_service(Mock(),1)

    assert result["success"] is True
    assert result["Message"] == "All the users watchlist"
    assert len(result["watchlist"]) == 1
    assert result["watchlist"][0]["ticker"] == "AAPL"
    assert result["watchlist"][0]["current_price"] == 200
    assert result["highest"]["ticker"] == "AAPL"
    assert result["lowest"]["ticker"] == "AAPL"

@patch("app.watchlist.watchlist.remove_watchlist")
def test_remove_watchlist_service(mock_remove):
    result = remove_watchlist_service(Mock(),1,10)

    assert result["success"] is True
    assert result["Message"] == "Deleted watchlist successfully"



