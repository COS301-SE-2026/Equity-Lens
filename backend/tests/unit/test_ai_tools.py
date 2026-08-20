import pandas as pd
import pytest
from unittest.mock import MagicMock, patch
from app.services import ai_service
from app.services.ai_service import get_market_news_tool, get_stock_data_tool

@pytest.fixture(autouse = True)
def clear_news_cache():
    ai_service._NEWS_CACHE.clear()
    yield
    ai_service._NEWS_CACHE.clear()

@patch("app.services.ai_service.requests.get")
def test_news_headlines(mock_get):
    response = MagicMock()
    response.json.return_value = {"results": 
        [
            {
                "title":"Rates held steady",
                "source_name": "Moneyweb",
                "description": "The reserve bank kept the repo rate unchanged."
            }, 
            {
                "title":"Long story",
                "source_name": "Reuters",
                "description": "x" * 300
            }
        ]}
    mock_get.return_value = response

    with patch.object(ai_service.settings, "newsdata_api_key", "test-key"):
        output = get_market_news_tool()

    assert "Recent headlines:" in output
    assert "Rates held steady" in output
    assert "Moneyweb" in output
    assert "The reserve bank kept the repo rate unchanged." in output

    assert ("x" * 250) + "..." in output
    assert "x" * 251 not in output

    params = mock_get.call_args.kwargs["params"]
    assert params["category"] == "business"
    assert "q" not in params


@patch("app.services.ai_service.get_cached_price_history")
def test_price_return(mock_h):
    time_frame = pd.date_range(start = "2026-08-10", periods = 2, freq = "D")
    mock_h.return_value = pd.DataFrame(
        {
            "Close": [10000.00, 11000.00],
            "Prev Close": [None, 10000.00]
        },
        index = time_frame
    )

    data = get_stock_data_tool("sol.jo")

    assert "SOL.JO" in data
    assert "R110.00" in data
    assert "R100.00" in data
    assert "+10.00%" in data