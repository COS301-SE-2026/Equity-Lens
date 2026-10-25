from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.responses import AppError
from app.services.cognito_service import cognito_get_user
from app.services.guest_token import is_guest_token, verify_guest_token
from app.services.token_verifier import (
    TokenVerificationUnavailableError,
    _rejected,
    verify_access_token,
)

auth_scheme = HTTPBearer()
_verified_locally_logged = False


def guest_forbidden() -> AppError:
    return AppError(403, "GUEST_FORBIDDEN", "not available in guest mode - create an account")


def _current_guest(user_repo: UserRepository, token: str) -> User:
    claims = verify_guest_token(token)
    try:
        user = user_repo.get_by_id(UUID(claims["sub"]))
    except ValueError:
        raise _rejected() from None

    if user is None or user.is_guest is not True or not user.is_active:
        raise _rejected()
    expires = user.guest_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires is None or expires <= datetime.now(UTC):
        raise _rejected()
    return user


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    token = cred.credentials
    user_repo = UserRepository(db)

    if is_guest_token(token):
        return _current_guest(user_repo, token)

    try:
        claims = verify_access_token(token)
    except TokenVerificationUnavailableError:
        user_info = cognito_get_user(token)
        return user_repo.get_or_create_cognito_user(
            cognito_sub=user_info["sub"],
            email=user_info["email"],
            full_name=user_info.get("full_name", ""),
        )

    existing = user_repo.get_by_cognito_sub(claims["sub"])
    if existing:
        return existing

    user_info = cognito_get_user(token)
    return user_repo.get_or_create_cognito_user(
        cognito_sub=user_info["sub"],
        email=user_info["email"],
        full_name=user_info.get("full_name", ""),
    )

def require_registered_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.is_guest:
        raise guest_forbidden()
    return current_user
