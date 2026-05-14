def test_get_portfolio_authenticated(client, auth_headers):
    response = client.get("/api/portfolio", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "holdings" in data
    assert "sectorAllocation" in data
    assert "performanceHistory" in data


def test_get_portfolio_unauthenticated(client):
    response = client.get("/api/portfolio")
    assert response.status_code == 422


def test_get_portfolio_summary_authenticated(client, auth_headers):
    response = client.get("/api/portfolio/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "totalValue" in data
    assert "totalGain" in data
    assert "holdingsCount" in data


def test_get_sector_allocation_authenticated(client, auth_headers):
    response = client.get("/api/portfolio/sectors", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "sector" in data[0]
    assert "percentage" in data[0]


def test_get_performance_history_authenticated(client, auth_headers):
    response = client.get("/api/portfolio/performance", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert "date" in data[0]
    assert "value" in data[0]