import pytest
from app.services.auth_service import hash_password, verify_password, create_access_token, decode_token
from app.schemas.auth import RegisterRequest, LoginRequest
from app.utils.exceptions import UserAlreadyExistsException, InvalidCredentialsException


def test_hash_password_produces_different_hash():
    hashed = hash_password("Password1")
    assert hashed != "Password1"


def test_verify_password_correct():
    hashed = hash_password("Password1")
    assert verify_password("Password1", hashed) is True


def test_verify_password_incorrect():
    hashed = hash_password("Password1")
    assert verify_password("WrongPassword", hashed) is False


def test_create_and_decode_token():
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    token = create_access_token(user_id)
    decoded_id = decode_token(token)
    assert decoded_id == user_id


def test_decode_invalid_token_raises():
    with pytest.raises(Exception):
        decode_token("invalid.token.here")


def test_register_new_user_success(client, sample_user_data):
    response = client.post("/api/auth/register", json=sample_user_data)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == sample_user_data["email"]
    assert data["full_name"] == sample_user_data["full_name"]
    assert "hashed_password" not in data


def test_register_duplicate_email_fails(client, sample_user_data):
    client.post("/api/auth/register", json=sample_user_data)
    response = client.post("/api/auth/register", json=sample_user_data)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_register_invalid_email_fails(client):
    response = client.post(
        "/api/auth/register",
        json={"full_name": "Test User", "email": "notanemail", "password": "Password1"},
    )
    assert response.status_code == 422


def test_register_weak_password_fails(client):
    response = client.post(
        "/api/auth/register",
        json={"full_name": "Test User", "email": "test@test.com", "password": "weak"},
    )
    assert response.status_code == 422


def test_login_valid_credentials_success(client, registered_user):
    response = client.post(
        "/api/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password_fails(client, registered_user):
    response = client.post(
        "/api/auth/login",
        json={"email": registered_user["email"], "password": "WrongPassword1"},
    )
    assert response.status_code == 401


def test_login_nonexistent_user_fails(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nobody@test.com", "password": "Password@1"},
    )
    assert response.status_code == 401


def test_get_current_user_with_valid_token(client, registered_user, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == registered_user["email"]


def test_get_current_user_with_invalid_token(client):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert response.status_code == 401