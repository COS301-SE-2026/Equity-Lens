import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import app.database as db_module
from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.user import User

@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db_module.Base.metadata.create_all(bind=engine)
    yield engine
    db_module.Base.metadata.drop_all(bind=engine)
    engine.dispose()

@pytest.fixture()
def db_session(db_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture()
def client(db_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()

@pytest.fixture()
def sample_user_data():
    return {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "Password1!",
    }

@pytest.fixture()
def test_user(db_session, sample_user_data):
    user = User(
        email=sample_user_data["email"],
        full_name=sample_user_data["full_name"],
        hashed_password=None,
        cognito_sub="test-cognito-sub-123",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture()
def registered_user(client, sample_user_data):
    with patch("app.routers.auth.cognito.cognito_register") as mock_register:
        mock_register.return_value = {
            "user_sub": "test-cognito-sub-123",
            "email": sample_user_data["email"],
        }
        client.post("/api/auth/register", json=sample_user_data)
    return sample_user_data

@pytest.fixture()
def auth_headers(test_user):
    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        yield {"Authorization": "Bearer fake-token"}
    finally:
        app.dependency_overrides.pop(get_current_user, None)