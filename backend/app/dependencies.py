
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.user_repository import UserRepository
from app.services.cognito_service import cognito_get_user
from app.services.token_verifier import TokenVerificationUnavailable, verify_access_token

auth_scheme = HTTPBearer()
_verified_locally_logged = False



def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    token = cred.credentials
    user_repo = UserRepository(db)

    try:
        claims = verify_access_token(token)
    except TokenVerificationUnavailable:
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
