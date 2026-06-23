import pytest
from uuid import uuid4
from app.repositories.user_repository import UserRepository
from app.services.auth_service import hash_password
from app.dependencies import get_current_user
from app.main import app

API_URL = "/api/portfolio"
HOLDINGS_URL = f"{API_URL}/holdings"

@pytest.fixture
def base_payload():
    return {
        "ticker": "NPN",
        "name": "Naspers",
        "sector": "Technology",
        "quantity": 10,
        "avg_price": 2800.0,
        "currency": "ZAR",
        "source": "manual",
    }

def test_get_portfolio_empty_for_new_user(client, auth_headers):
    response = client.get(API_URL, headers=auth_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["holdings"] == []
    assert data["summary"]["holdingsCount"] == 0

def test_get_portfolio_unauthenticated(client):
    assert client.get(API_URL).status_code == 403

def test_create_holding(client, auth_headers, base_payload):
    payload = {**base_payload, "ticker": "npn"}
    response = client.post(HOLDINGS_URL, headers=auth_headers, json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert data["ticker"] == "NPN"
    assert data["quantity"] == 10

def test_create_holding_rejects_zero_quantity(client, auth_headers, base_payload):
    payload = {**base_payload, "quantity": 0}
    response = client.post(HOLDINGS_URL, headers=auth_headers, json=payload)
    assert response.status_code == 422

def test_create_holding_rejects_negative_price(client, auth_headers, base_payload):
    payload = {**base_payload, "avg_price": -100}
    response = client.post(HOLDINGS_URL, headers=auth_headers, json=payload)
    assert response.status_code == 422

def test_created_holding_appears_in_portfolio(client, auth_headers, base_payload):
    payload = {**base_payload, "ticker": "MTN", "name": "MTN Group", "avg_price": 120}
    client.post(HOLDINGS_URL, headers=auth_headers, json=payload)
    
    response = client.get(API_URL, headers=auth_headers)
    data = response.json()
    assert len(data["holdings"]) == 1
    assert data["holdings"][0]["ticker"] == "MTN"

def test_update_holding(client, auth_headers, base_payload):
    create_res = client.post(HOLDINGS_URL, headers=auth_headers, json=base_payload)
    holding_id = create_res.json()["id"]

    update_res = client.put(
        f"{HOLDINGS_URL}/{holding_id}",
        headers=auth_headers,
        json={"quantity": 40}, )
    
    assert update_res.status_code == 200
    assert update_res.json()["quantity"] == 40

def test_update_nonexistent_holding_returns_404(client, auth_headers):
    response = client.put(
        f"{HOLDINGS_URL}/{uuid4()}",
        headers=auth_headers,
        json={"quantity": 10}, )
    
    assert response.status_code == 404

def test_delete_holding(client, auth_headers, base_payload):
    create_res = client.post(HOLDINGS_URL, headers=auth_headers, json=base_payload)
    holding_id = create_res.json()["id"]

    assert client.delete(f"{HOLDINGS_URL}/{holding_id}", headers=auth_headers).status_code == 204

    get_res = client.get(API_URL, headers=auth_headers)
    assert get_res.json()["holdings"] == []

def test_delete_nonexistent_holding_returns_404(client, auth_headers):
    assert client.delete(f"{HOLDINGS_URL}/{uuid4()}", headers=auth_headers).status_code == 404

def test_user_cannot_see_other_users_holdings(client, auth_headers, db_session, base_payload):
    client.post(HOLDINGS_URL, headers=auth_headers, json=base_payload)

    other_user = UserRepository(db_session).create_user(
        email="other@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Other User" ,)

    app.dependency_overrides[get_current_user] = lambda: other_user
    try:
        response = client.get(API_URL, headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        assert response.json()["holdings"] == []
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_get_summary_calculates_correctly(client, auth_headers, base_payload):
    client.post(HOLDINGS_URL, headers=auth_headers, json=base_payload)
    
    response = client.get(f"{API_URL}/summary", headers=auth_headers)
    data = response.json()
    assert data["holdingsCount"] == 1
    assert data["totalCost"] == 28000

def test_get_sectors_groups_correctly(client, auth_headers, base_payload):
    client.post(HOLDINGS_URL, headers=auth_headers, json=base_payload)
    
    other_payload = {
        **base_payload,
        "ticker": "MTN",
        "name": "MTN Group",
        "sector": "Telecommunications",
        "avg_price": 120,
    }
    client.post(HOLDINGS_URL, headers=auth_headers, json=other_payload)
    
    response = client.get(f"{API_URL}/sectors", headers=auth_headers)
    sectors = {s["sector"] for s in response.json()}
    assert sectors == {"Technology", "Telecommunications"}