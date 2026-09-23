import uuid
from unittest.mock import MagicMock, patch
from app.models.chat import ChatConversation, ChatMessages
from app.services.ai_service import chat_stream, MAX_TOOL_ITERATIONS, SYSTEM_RULES


def text_round(*chunks, stop_reason = "end_turn"):
    events = [{"contentBlockDelta": {"delta": {"text": c}}} for c in chunks]
    events.append({"contentBlockStop": {}})
    events.append({"messageStop": {"stopReason": stop_reason}})
    return {"stream": events}


def tool_round(name, input_fragments, tool_use_id = "tu-1"):
    events = [{"contentBlockStart": {"start": {"toolUse": {"toolUseId": tool_use_id, "name": name}}}}]
    events += [{"contentBlockDelta": {"delta": {"toolUse": {"input": f}}}} for f in input_fragments]
    events.append({"contentBlockStop": {}})
    events.append({"messageStop": {"stopReason": "tool_use"}})
    return {"stream": events}


def stream_client(*rounds):
    client = MagicMock()
    client.converse_stream.side_effect = list(rounds)
    return client


def drain(gen):
    events = list(gen)
    text = "".join(e["value"] for e in events if e["type"] == "text")
    done = [e for e in events if e["type"] == "done"]
    return events, text, done


@patch("app.services.ai_service.get_bedrock_client")
def test_stream_text_order(mock_client, db_session, test_user):
    mock_client.return_value = stream_client(text_round("Sasol ", "closed ", "at R150."))

    events, text, done = drain(chat_stream("how is sasol", db_session, test_user.id))

    assert [e["type"] for e in events] == ["text", "text", "text", "done"]
    assert text == "Sasol closed at R150."
    assert len(done) == 1
    assert done[0]["conversation_id"]


@patch("app.services.ai_service.get_bedrock_client")
def test_stream_persists_rows(mock_client, db_session, test_user):
    mock_client.return_value = stream_client(text_round("Part one. ", "Part two."))

    _, _, done = drain(chat_stream("a question", db_session, test_user.id))
    conversation_id = uuid.UUID(done[0]["conversation_id"])

    rows = (db_session.query(ChatMessages)
            .filter(ChatMessages.conversation_id == conversation_id)
            .order_by(ChatMessages.created_at.asc()).all())

    assert [r.role for r in rows] == ["user", "assistant"]
    assert rows[0].content == "a question"
    assert rows[1].content == "Part one. Part two."

    conversation = db_session.query(ChatConversation).filter(
        ChatConversation.id == conversation_id).first()
    assert conversation.user_id == test_user.id


@patch("app.services.ai_service.run_tool")
@patch("app.services.ai_service.get_bedrock_client")
def test_fragmented_tool_input(mock_client, mock_run_tool, db_session, test_user):
    mock_run_tool.return_value = "SOL.JO closed at R150.00."
    mock_client.return_value = stream_client(
        tool_round("get_stock_data", ['{"tick', 'er": "SOL', '.JO"}']),
        text_round("Sasol closed at R150.00."),
    )

    _, text, done = drain(chat_stream("how is sasol", db_session, test_user.id))

    name, tool_input = mock_run_tool.call_args.args[0], mock_run_tool.call_args.args[1]
    assert name == "get_stock_data"
    assert tool_input == {"ticker": "SOL.JO"}

    assert text == "Sasol closed at R150.00."
    assert len(done) == 1

    messages = mock_client.return_value.converse_stream.call_args_list[1].kwargs["messages"]
    results = [c for m in messages for c in m.get("content", []) if "toolResult" in c]
    assert results[0]["toolResult"]["content"][0]["text"] == "SOL.JO closed at R150.00."
    assert db_session.query(ChatMessages).count() == 2


@patch("app.services.ai_service.run_tool")
@patch("app.services.ai_service.get_bedrock_client")
def test_stream_exhaustion(mock_client, mock_run_tool, db_session, test_user):      
    mock_run_tool.return_value = "a result"
    client = stream_client(
        *[tool_round("get_stock_data", ['{"ticker": "SOL.JO"}'], f"tu-{i}")
          for i in range(MAX_TOOL_ITERATIONS)],
        text_round("Here is what I found."),
    )
    mock_client.return_value = client

    _, text, done = drain(chat_stream("how is sasol", db_session, test_user.id))

    assert client.converse_stream.call_count == MAX_TOOL_ITERATIONS + 1
    assert mock_run_tool.call_count == MAX_TOOL_ITERATIONS

    calls = client.converse_stream.call_args_list
    assert all("toolConfig" in c.kwargs for c in calls[:MAX_TOOL_ITERATIONS])
    assert "toolConfig" not in calls[-1].kwargs      
    
    assert text == "Here is what I found."
    assert len(done) == 1


@patch("app.services.ai_service.get_bedrock_client")
def test_stream_falls_back(mock_client, db_session, test_user):
    mock_client.return_value = stream_client(text_round())
    _, text, done = drain(chat_stream("a question", db_session, test_user.id))

    row = (db_session.query(ChatMessages)
           .filter(ChatMessages.role == "assistant").first())
    
    assert row.content == "Sorry, I couldn't finish that one. Try asking again."
    assert text == "Sorry, I couldn't finish that one. Try asking again."


@patch("app.services.ai_service.get_bedrock_client")
def test_stream_cache_breakpoint(mock_client, db_session, test_user):
    client = stream_client(text_round("ok"))
    mock_client.return_value = client
    
    drain(chat_stream("a question", db_session, test_user.id))

    system = client.converse_stream.call_args.kwargs["system"]

    assert "cachePoint" in system[1]
    assert "<portfolio_context>" in system[2]["text"]
    assert system[0]["text"] == SYSTEM_RULES
