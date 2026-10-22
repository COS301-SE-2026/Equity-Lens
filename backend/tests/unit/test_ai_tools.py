from unittest.mock import MagicMock, patch
from datetime import UTC, datetime
import pandas as pd

from app.models.chat import ChatMessages
from app.services import ai_service
from app.services.ai_service import (
    MAX_NEWS_ARTICLES,
    chat,
    get_market_news_tool,
    get_stock_data_tool,
)


@patch("app.services.news_ingest.requests.get")
def test_news_headlines(mock_get):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"data":
        [
            {
                "title": "Rates held steady",
                "source": "Moneyweb",
                "published_at": "2026-09-19T08:00:00.000000Z",
                "description": "The reserve bank kept the repo rate unchanged.",
                "entities": [
                    {
                        "symbol": "SOL.JO",
                        "sentiment_score": 0.42,
                        "highlights": [
                            {
                                "highlight": "Sasol gained on the news.",
                                "highlighted_in": "main_text",
                            }
                        ],
                    }
                ],
            },
            {
                "title": "Long story",
                "source": "Reuters",
                "published_at": "2026-09-19T09:00:00.000000Z",
                "description": "x" * 300,
                "entities": [],
            },
        ]}
    mock_get.return_value = response

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        output = get_market_news_tool(db_session)

    assert "News from the last 30 days, newest first:" in output
    assert "Rates held steady" in output
    assert "Moneyweb" in output
    assert "Sentiment for SOL.JO: positive" in output
    assert "Sasol gained on the news." in output
    assert ("x" * 250) + "..." in output
    assert "x" * 251 not in output

    params = mock_get.call_args.kwargs["params"]

    assert params["api_token"] == "test-key"
    assert params["limit"] == MAX_NEWS_ARTICLES
    assert "search" not in params
    assert params["sort"] == "published_on"
    assert "published_after" in params
    assert "Today is" in output


def _news_response(status_code=200, body=None):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = body if body is not None else {"data": []}
    return response

@patch("app.services.news_ingest.requests.get")
def test_search_newest_first(mock_get):
    mock_get.return_value = _news_response()
    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        output = get_market_news_tool("Sasol")
    params = mock_get.call_args.kwargs["params"]
    assert params["search"] == "Sasol"
    assert params["sort"] == "published_on"
    assert "published_after" in params
    assert "No news about 'Sasol'" in output


@patch("app.services.news_ingest.requests.get")
def test_ticker_symbols(mock_get):
    mock_get.return_value = _news_response()

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        get_market_news_tool("sol.jo")

    params = mock_get.call_args.kwargs["params"]
    assert params["symbols"] == "SOL.JO"
    assert params["countries"] == "za"
    assert "search" not in params


@patch("app.services.news_ingest.requests.get")
def test_not_treated_ticker(mock_get):
    mock_get.return_value = _news_response()

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        get_market_news_tool("MTN")

    params = mock_get.call_args.kwargs["params"]
    assert params["search"] == "MTN"
    assert "symbols" not in params


@patch("app.services.news_ingest.requests.get")
def test_usage_limit(mock_get):
    mock_get.return_value = _news_response(402, {"error": {"code": "usage_limit_reached"}})

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        output = get_market_news_tool("Sasol")

    assert "usage limit" in output

@patch("app.services.news_ingest.requests.get")
@patch("app.services.ai_service.NewsRepository")
def test_news_ticker_uses_stored_articles_first(mock_repo, mock_get):
    ticker_row = MagicMock(
        ticker="MTN.JO", sentiment_score=-0.4, highlight="MTN fell on the results."
    )
    article = MagicMock(
        title="MTN results disappoint",
        source_name="Moneyweb",
        description="Subscriber numbers fell.",
        tickers=[ticker_row],
    )
    article.published_at = datetime(2026, 10, 10, tzinfo=UTC)
    mock_repo.return_value.articles_in_window.return_value = [article]

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        output = get_market_news_tool("MTN.JO", db=MagicMock())
  
    assert "MTN results disappoint" in output
    assert "2026-10-10" in output
    assert "Sentiment for MTN.JO: negative" in output
    mock_get.assert_not_called()


@patch("app.services.news_ingest.requests.get")
def test_falls_back(mock_get):
    older = {"data": [{
        "title": "Standard Bank results",
        "source": "Moneyweb",
        "published_at": "2026-08-13T08:00:00.000000Z",
        "entities": [],
    }]}
    mock_get.side_effect = [_news_response(), _news_response(body=older)]

    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        output = get_market_news_tool("SBK.JO")

    assert mock_get.call_count == 2
    first, second = (c.kwargs["params"]["published_after"] for c in mock_get.call_args_list)
    assert second < first
    assert "no news in the last 30 days" in output
    assert "Standard Bank results" in output
    assert "2026-08-13" in output


  
@patch("app.services.news_ingest.requests.get")
def test_us_suffix_dropped(mock_get):
    mock_get.return_value = _news_response()
    
    with patch.object(ai_service.settings, "market_api_key", "test-key"):
        get_market_news_tool("AAPL.US")

    params = mock_get.call_args.kwargs["params"]
    assert params["symbols"] == "AAPL"
    assert params["countries"] == "us"


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


@patch("app.services.ai_service.get_cached_price_history")        
@patch("app.services.ai_service.get_bedrock_client")
def test_chat_runs_the_stock_tool(mock_bedrock_client, mock_h, db_session, test_user):
    time_frame = pd.date_range(start = "2026-08-10", periods = 2, freq = "D")
    mock_h.return_value = pd.DataFrame(
        {
            "Close": [10000.00, 11000.00],
            "Prev Close": [None, 10000.00]
        },
        index = time_frame
    )
    mocked_client = MagicMock()
    mocked_client.converse.side_effect = [
        {
            "stopReason": "tool_use",
            "output": {"message": {"role": "assistant", "content":
                [
                    {"text": "Let me check that."},
                    {"toolUse":
                        {
                            "toolUseId": "tool-1",
                            "name": "get_stock_data",
                            "input": {"ticker": "SOL.JO"}
                    }}
                ]}}
        },

        { "output": {"message": {"content": [{"text": "Sasol closed at R110.00."}]}}},
        {"output": {"message": {"content": [{"text": "[]"}]}}},
        {"output": {"message": {"content": [{"text": "Sasol price"}]}}}
    ]
    mock_bedrock_client.return_value = mocked_client
    reply, conversation_id = chat("How is Sasol doing?", db_session, test_user.id)
    assert reply == "Sasol closed at R110.00."
    assert mocked_client.converse.call_count == 2

    assert mock_h.call_args.args[0] == "SOL.JO"

    history = mocked_client.converse.call_args_list[1].kwargs["messages"] 
    results = [b for m in history for b in m["content"] if "toolResult" in b]
    assert len(results) == 1
    assert results[0]["toolResult"]["status"] == "success"        
    assert "R110.00" in results[0]["toolResult"]["content"][0]["text"]
    
    saved = db_session.query(ChatMessages).filter_by(conversation_id = conversation_id).all()
    assert len(saved) == 2