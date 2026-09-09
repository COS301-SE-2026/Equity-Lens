import logging

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.cognito_service import cognito_get_user
from app.services.token_verifier import TokenVerificationUnavailable, verify_access_token

logger = logging.getLogger(__name__)

auth_scheme = HTTPBearer()
_verified_locally_logged = False


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    global _verified_locally_logged

    repo = UserRepository(db)
    sub = None

    try:
        sub = verify_access_token(cred.credentials)["sub"]
        if not _verified_locally_logged:
            logger.info("verifying cognito access tokens locally")
            _verified_locally_logged = True
    except TokenVerificationUnavailable as exc:
        logger.error("local token verification unavailable, falling back to Cognito: %s", exc)

    if sub is not None:
        user = repo.get_by_cognito_sub(sub)
        if user is not None:
            return user
        
    info = cognito_get_user(cred.credentials)
    return repo.get_or_create_cognito_user(
        cognito_sub=info["sub"],
        email=info["email"],
        full_name=info.get("full_name", ""),
    )
