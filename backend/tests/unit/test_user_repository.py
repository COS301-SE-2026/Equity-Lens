from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.repositories.user_repository import UserRepository


def make_user(db_session, **overrides):
    fields = {
        "id": uuid4(),
        "email": "existing@example.com",
        "full_name": "Existing User",
        "hashed_password": None,
        "cognito_sub": None,
    }
    fields.update(overrides)
    user = User(**fields)
    db_session.add(user)
    db_session.commit()
    return user


def test_adopts_row_with_no_cognito_sub(db_session):
    existing = make_user(db_session)
    original_id = existing.id
    repo = UserRepository(db_session)

    user = repo.get_or_create_cognito_user("new-sub", "existing@example.com", "Existing User")

    assert user.id == original_id
    assert user.cognito_sub == "new-sub"
    assert db_session.query(User).count() == 1


def test_adopts_row_with_a_different_cognito_sub(db_session):
    existing = make_user(db_session, cognito_sub="old-sub")
    original_id = existing.id
    repo = UserRepository(db_session)

    user = repo.get_or_create_cognito_user("new-sub", "existing@example.com", "Existing User")

    assert user.id == original_id
    assert user.cognito_sub == "new-sub"
    assert db_session.query(User).count() == 1


def test_does_not_overwrite_an_existing_full_name(db_session):
    make_user(db_session, full_name="Malcolm Heath")
    repo = UserRepository(db_session)

    user = repo.get_or_create_cognito_user("new-sub", "existing@example.com", "M H")

    assert user.full_name == "Malcolm Heath"


def test_fills_a_blank_full_name(db_session):
    make_user(db_session, full_name="")
    repo = UserRepository(db_session)

    user = repo.get_or_create_cognito_user("new-sub", "existing@example.com", "Malcolm Heath")

    assert user.full_name == "Malcolm Heath"


def test_insert_conflict_falls_back_to_the_row_the_other_request_wrote(db_session):
    winner = User(
        id=uuid4(),
        email="race@example.com",
        full_name="Race",
        hashed_password=None,
        cognito_sub="race-sub",
    )
    repo = UserRepository(db_session)
    conflict = IntegrityError("INSERT INTO users", {}, Exception("duplicate key"))

    with patch.object(repo, "get_by_cognito_sub", side_effect=[None, winner]), \
         patch.object(repo, "get_by_email", return_value=None), \
         patch.object(db_session, "commit", side_effect=conflict):
        user = repo.get_or_create_cognito_user("race-sub", "race@example.com", "Race")

    assert user is winner


def test_insert_conflict_reraises_when_nothing_is_found(db_session):
    repo = UserRepository(db_session)
    conflict = IntegrityError("INSERT INTO users", {}, Exception("duplicate key"))

    with patch.object(repo, "get_by_cognito_sub", return_value=None), \
         patch.object(repo, "get_by_email", return_value=None), \
         patch.object(db_session, "commit", side_effect=conflict), \
         pytest.raises(IntegrityError):
        repo.get_or_create_cognito_user("race-sub", "race@example.com", "Race")
