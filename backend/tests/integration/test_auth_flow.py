from unittest.mock import patch


def test_full_registration_login_flow(client, sample_user_data):
    fake_tokens = {
        "AccessToken": "fake-access-token",
        "IdToken": "fake-id-token",
        "RefreshToken": "fake-refresh-token",
        "ExpiresIn": 3600,
        "TokenType": "Bearer",
    }
    with patch("app.routers.auth.cognito.cognito_register") as mock_register, \
         patch("app.routers.auth.cognito.cognito_login") as mock_login:
        mock_register.return_value = {
            "user_sub": "test-cognito-sub-123",
            "email": sample_user_data["email"],
        }
        mock_login.return_value = {"AuthenticationResult": fake_tokens}

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
        assert "AuthenticationResult" in login_response.json()


def test_duplicate_registration_fails(client, sample_user_data):
    from fastapi import HTTPException

    with patch("app.routers.auth.cognito.cognito_register") as mock_register:
        mock_register.return_value = {
            "user_sub": "first-sub",
            "email": sample_user_data["email"],
        }
        client.post("/api/auth/register", json=sample_user_data)

        mock_register.side_effect = HTTPException(
            status_code=409, detail="email already registered"
        )
        second = client.post("/api/auth/register", json=sample_user_data)
        assert second.status_code == 409


def test_cannot_access_protected_route_without_token(client):
    # HTTPBearer 403s on missing auth, not 422
    response = client.get("/api/auth/me")
    assert response.status_code == 403


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"