from unittest.mock import patch

import pytest


# router tests — cognito is mocked

def test_register_new_user_success(client, sample_user_data):
    with patch("app.routers.auth.cognito.cognito_register") as mock_register:
        mock_register.return_value = {
            "user_sub": "fake-sub",
            "email": sample_user_data["email"],
        }
        response = client.post("/api/auth/register", json=sample_user_data)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == sample_user_data["email"]
    assert data["user_sub"] == "fake-sub"


def test_register_duplicate_email_fails(client, sample_user_data):
    from fastapi import HTTPException

    with patch("app.routers.auth.cognito.cognito_register") as mock_register:
        mock_register.side_effect = HTTPException(
            status_code=409, detail="email already registered"
        )
        response = client.post("/api/auth/register", json=sample_user_data)

    assert response.status_code == 409
    assert "email already registered" in response.json()["detail"]


def test_register_invalid_email_fails(client):
    response = client.post(
        "/api/auth/register",
        json={"full_name": "Test User", "email": "notanemail", "password": "Password1"},
    )
    assert response.status_code == 422


def test_login_returns_tokens(client, sample_user_data):
    fake_tokens = {
        "AccessToken": "fake-access-token",
        "IdToken": "fake-id-token",
        "RefreshToken": "fake-refresh-token",
        "ExpiresIn": 3600,
        "TokenType": "Bearer",
    }
    with patch("app.routers.auth.cognito.cognito_login") as mock_login:
        mock_login.return_value = {"AuthenticationResult": fake_tokens}
        response = client.post(
            "/api/auth/login",
            json={"email": sample_user_data["email"], "password": sample_user_data["password"]},
        )

    assert response.status_code == 200
    data = response.json()
    assert "AuthenticationResult" in data
    assert data["AuthenticationResult"]["AccessToken"] == "fake-access-token"


def test_login_returns_mfa_challenge(client, sample_user_data):
    challenge = {
        "ChallengeName": "SOFTWARE_TOKEN_MFA",
        "Session": "fake-session-token",
        "ChallengeParameters": {"USER_ID_FOR_SRP": sample_user_data["email"]},
    }
    with patch("app.routers.auth.cognito.cognito_login") as mock_login:
        mock_login.return_value = challenge
        response = client.post(
            "/api/auth/login",
            json={"email": sample_user_data["email"], "password": sample_user_data["password"]},
        )

    assert response.status_code == 200
    assert response.json()["ChallengeName"] == "SOFTWARE_TOKEN_MFA"


def test_login_invalid_credentials_fails(client, sample_user_data):
    from fastapi import HTTPException

    with patch("app.routers.auth.cognito.cognito_login") as mock_login:
        mock_login.side_effect = HTTPException(
            status_code=401,
            detail="invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": sample_user_data["email"], "password": "wrong"},
        )

    assert response.status_code == 401


def test_get_current_user_with_valid_token(client, auth_headers, test_user):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == test_user.email


def test_get_current_user_without_token_returns_403(client):
    # HTTPBearer returns 403 when no auth header present, not 422
    response = client.get("/api/auth/me")
    assert response.status_code == 403