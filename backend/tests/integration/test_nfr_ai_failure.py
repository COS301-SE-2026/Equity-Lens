from types import SimpleNamespace
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

def fake_user():
    return SimpleNamespace(id=1)

def fake_db():
    yield None

app.dependency_overrides[get_current_user] = fake_user
app.dependency_overrides[get_db] = fake_db

client = TestClient(app, raise_server_exceptions=False)

def test_ai_provide_failure_returns_controlled_error(mocker):
    mocker.patch("app.routers.ai_chat.chat", side_effect=Exception("Bedrock unavailable"))

    response = client.post(
        "/api/ai_chat/",
        json={
            "message": "hello"
        }
    )

    assert response.status_code == 500

    assert response.json()["detail"] == "Something went wrong"
