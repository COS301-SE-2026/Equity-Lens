import pytest
from uuid import uuid4
from app.repositories.user_repository import UserRepository
from app.repositories.holding_repository import HoldingRepository
from app.services.auth_service import hash_password

@pytest.fixture
def repo(db_session):
    return HoldingRepository(db_session)

@pytest.fixture
def user(db_session):
    return UserRepository(db_session).create_user(
        email="primary@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Primary User",
    )

@pytest.fixture
def holding_data():
    return {
        "ticker": "NPN",
        "name": "Naspers",
        "sector": "Technology",
        "quantity": 10,
        "avg_price": 2800,
        "currency": "ZAR",
        "source": "manual",
    }

def test_create_holding(repo, user, holding_data):
    holding = repo.create_holding(user_id=user.id, **holding_data)

    assert holding.id is not None
    assert holding.ticker == "NPN"
    assert holding.user_id == user.id


def test_get_holdings_by_user_returns_only_own_holdings(db_session, repo, user, holding_data):
    repo.create_holding(user_id=user.id, **holding_data)

    other_user = UserRepository(db_session).create_user(
        email="other@example.com",
        hashed_password="hash",
        full_name="Other User",
    )
    repo.create_holding(
        user_id=other_user.id, ticker="MTN", name="MTN Group",
        quantity=50, avg_price=120, currency="ZAR", source="manual"
    )

    user_holdings = repo.get_holdings_by_user(user.id)

    assert len(user_holdings) == 1
    assert user_holdings[0].ticker == "NPN"

def test_get_holding_by_id_enforces_ownership(db_session, repo, user, holding_data):
    holding = repo.create_holding(user_id=user.id, **holding_data)
    
    other_user = UserRepository(db_session).create_user(
        email="other@example.com",
        hashed_password="hash",
        full_name="Other User",
    )

    assert repo.get_holding_by_id(holding.id, user.id) is not None
    assert repo.get_holding_by_id(holding.id, other_user.id) is None

def test_get_holding_by_id_returns_none_for_nonexistent(repo, user):
    assert repo.get_holding_by_id(uuid4(), user.id) is None

def test_update_holding(repo, user, holding_data):
    holding = repo.create_holding(user_id=user.id, **holding_data)

    updated = repo.update_holding(holding, quantity=20, avg_price=2900)

    assert updated.quantity == 20
    assert updated.avg_price == 2900
    assert updated.ticker == "NPN"

def test_update_holding_ignores_none_values(repo, user, holding_data):
    holding = repo.create_holding(user_id=user.id, **holding_data)

    updated = repo.update_holding(holding, quantity=None, avg_price=3000)

    assert updated.quantity == 10
    assert updated.avg_price == 3000

def test_delete_holding(repo, user, holding_data):
    holding = repo.create_holding(user_id=user.id, **holding_data)
    holding_id = holding.id

    repo.delete_holding(holding)

    assert repo.get_holding_by_id(holding_id, user.id) is None

def test_multiple_holdings_same_user(repo, user, holding_data):
    repo.create_holding(user_id=user.id, **holding_data)
    repo.create_holding(
        user_id=user.id, ticker="MTN", name="MTN Group",
        quantity=50, avg_price=120, currency="ZAR", source="manual"
    )

    assert len(repo.get_holdings_by_user(user.id)) == 2