import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

@pytest.mark.parametrize("url", [
    "/api/portfolio",
    "/api/watchlist",
    "/api/news/portfolio-tickers",
])

def test_protected_routes(url):

    response = client.get(url)
    
    assert response.status_code == 401