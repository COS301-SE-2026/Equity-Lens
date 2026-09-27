import json
import uuid
from unittest.mock import patch

import pytest

from app.config import settings
from app.models.chat import UserMemory
from app.models.portfolio import Portfolios
from app.utils.exceptions import ConversationNotFoundException


def _frames(response):
    return [json.loads(line[len("data: ") :]) for line in response.text.split("\n\n") if line]


def test_daily_cap_returns_429(client, auth_headers):
    with patch.object(settings, "ai_daily_limit", 0):
        output = client.post("/api/ai_chat/", json={"message": "Hi"}, headers=auth_headers)

    assert output.status_code == 429
    assert "daily limit" in output.json()["detail"]["message"]
    assert int(output.headers["Retry-After"]) >= 1


@patch("app.routers.ai_chat.chat", side_effect=RuntimeError("bedrock down"))
def test_send_message_failure_returns_500(_mock_chat, client, auth_headers):
    output = client.post("/api/ai_chat/", json={"message": "Hi"}, headers=auth_headers)
    assert output.status_code == 500


@patch("app.routers.ai_chat.run_post_turn")
@patch("app.routers.ai_chat.SessionLocal")
@patch("app.routers.ai_chat.chat_stream")
def test_stream_sends_frames_then_runs_post_turn(
    mock_stream, _mock_session, mock_post_turn, client, test_user, auth_headers
):
    mock_stream.return_value = iter(
        [
            {"type": "text", "value": "Hello"},
            {"type": "done", "conversation_id": "abc"},
        ]
    )

    output = client.post("/api/ai_chat/stream/", json={"message": "Hi"}, headers=auth_headers)

    assert output.headers["content-type"].startswith("text/event-stream")
    assert _frames(output) == [
        {"type": "text", "value": "Hello"},
        {"type": "done", "conversation_id": "abc"},
    ]
    mock_post_turn.assert_called_once_with("abc", test_user.id, "Hi")


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (ConversationNotFoundException(), "Conversation not found"),
        (RuntimeError("boom"), "Something went wrong"),
    ],
)
@patch("app.routers.ai_chat.run_post_turn")
@patch("app.routers.ai_chat.SessionLocal")
@patch("app.routers.ai_chat.chat_stream")
def test_stream_errors_become_error_frames(
    mock_stream, _mock_session, mock_post_turn, client, auth_headers, error, message
):
    mock_stream.side_effect = error

    output = client.post("/api/ai_chat/stream/", json={"message": "Hi"}, headers=auth_headers)

    assert _frames(output) == [{"type": "error", "value": message}]
    mock_post_turn.assert_not_called()


def test_portfolios_numbered(client, db_session, test_user, auth_headers):
    db_session.add(Portfolios(user_id=test_user.id, portfolio_name="Growth", account_number="A1"))
    db_session.commit()

    output = client.get("/api/ai_chat/portfolios/", headers=auth_headers)

    assert output.status_code == 200
    assert output.json()[0]["label"] == "Portfolio 1"
    assert output.json()[0]["portfolio_name"] == "Growth"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/ai_chat/conversations/{id}/messages/"),
        ("put", "/api/ai_chat/conversations/{id}/"),
        ("delete", "/api/ai_chat/conversations/{id}/"),
        ("delete", "/api/ai_chat/memories/{id}/"),
    ],
)
def test_unknown_ids_return_404(client, auth_headers, method, path):
    kwargs = {"json": {"title": "x"}} if method == "put" else {}
    output = getattr(client, method)(path.format(id=uuid.uuid4()), headers=auth_headers, **kwargs)
    assert output.status_code == 404


def test_list_and_delete_memory(client, db_session, test_user, auth_headers):
    memory = UserMemory(user_id=test_user.id, fact="Wants to retire in 15 years")
    db_session.add(memory)
    db_session.commit()

    listed = client.get("/api/ai_chat/memories/", headers=auth_headers).json()
    assert [m["fact"] for m in listed] == ["Wants to retire in 15 years"]

    output = client.delete(f"/api/ai_chat/memories/{memory.id}/", headers=auth_headers)
    assert output.json() == {"detail": "Memory deleted"}
    assert client.get("/api/ai_chat/memories/", headers=auth_headers).json() == []
