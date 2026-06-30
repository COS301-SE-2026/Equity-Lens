PORTFOLIO_URL = "/api/portfolio"
SUMMARY_URL = "/api/portfolio/summary"
SECTORS_URL = "/api/portfolio/sectors"


def test_portfolio_requires_auth(client):
    response = client.get(PORTFOLIO_URL)
    assert response.status_code == 403


def test_portfolio_returns_empty_for_new_user(client, auth_headers):
    response = client.get(PORTFOLIO_URL, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["holdings"] == []
    assert body["summary"]["holdingsCount"] == 0
    assert body["sectorAllocation"] == []


def test_summary_endpoint(client, auth_headers):
    response = client.get(SUMMARY_URL, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["totalValue"] == 0.0


def test_sectors_endpoint(client, auth_headers):
    response = client.get(SECTORS_URL, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []