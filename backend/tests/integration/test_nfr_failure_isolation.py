from types import SimpleNamespace
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

def fake_user():
    return SimpleNamespace(id=1)

def fake_db():
    yield None

client = TestClient(app, raise_server_exceptions=False)

def test_news_failure_does_not_break_portfolio(mocker):
    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_db] = fake_db
    mocker.patch("app.routers.news.requests.get", side_effect=Exception("News provider unavailable"))

    mocker.patch("app.routers.portfolio.PortfolioService.get_dashboard", return_value = {"status": "portfolio working"})

    news_response = client.get("/api/news/?category=business")

    portfolio_response = client.get("/api/portfolio")

    assert news_response.status_code == 500

    assert portfolio_response.status_code == 200



