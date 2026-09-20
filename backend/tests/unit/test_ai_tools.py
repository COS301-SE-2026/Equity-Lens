import pandas as pd
import pytest
from unittest.mock import MagicMock, patch
from app.services import ai_service
from app.services.ai_service import chat, get_market_news_tool, get_stock_data_tool, MAX_NEWS_ARTICLES
from app.models.chat import ChatMessages

@patch("app.services.ai_service.requests.get")
def test_news_headlines(mock_get):
    response = MagicMock()
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
                        "highlights": [{"highlight": "Sasol gained on the news.", "highlighted_in": "main_text"}],
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
        output = get_market_news_tool()

    assert "Recent market news:" in output
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
    reply, conversation_id, _ = chat("How is Sasol doing?", db_session, test_user.id)
    assert reply == "Sasol closed at R110.00."
    assert mocked_client.converse.call_count == 4

    assert mock_h.call_args.args[0] == "SOL.JO"

    history = mocked_client.converse.call_args_list[1].kwargs["messages"] 
    results = [b for m in history for b in m["content"] if "toolResult" in b]
    assert len(results) == 1
    assert results[0]["toolResult"]["status"] == "success"        
    assert "R110.00" in results[0]["toolResult"]["content"][0]["text"]
    
    saved = db_session.query(ChatMessages).filter_by(conversation_id = conversation_id).all()
    assert len(saved) == 2