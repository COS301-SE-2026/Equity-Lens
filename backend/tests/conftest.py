# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.database as db_module
from app.main import app
from app.database import get_db
from app.models import user

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

test_engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture()
def client():
    db_module.engine = test_engine
    db_module.SessionLocal = TestingSessionLocal

    db_module.Base.metadata.create_all(bind=test_engine)

    session = TestingSessionLocal()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)

    app.dependency_overrides.clear()
    session.close()
    db_module.Base.metadata.drop_all(bind=test_engine)

@pytest.fixture()
def sample_user_data():
    return {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "Password1!"
    }

@pytest.fixture()
def registered_user(client, sample_user_data):
    client.post("/api/auth/register", json=sample_user_data)
    return sample_user_data

@pytest.fixture()
def auth_headers(client, registered_user):
    response = client.post(
        "/api/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"]
        }
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}