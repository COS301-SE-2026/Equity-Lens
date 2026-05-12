def test_full_registration_login_access_flow(client, sample_user_data):
    register_response = client.post("/api/auth/register", json=sample_user_data)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"],
        },
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == sample_user_data["email"]


def test_duplicate_registration_fails(client, sample_user_data):
    client.post("/api/auth/register", json=sample_user_data)
    second = client.post("/api/auth/register", json=sample_user_data)
    assert second.status_code == 409


def test_cannot_access_protected_route_without_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 422


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"