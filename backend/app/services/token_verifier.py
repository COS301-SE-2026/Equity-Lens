import logging
from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

from app.config import settings
from app.schemas.responses import AppError

logger = logging.getLogger(__name__)

JWKS_CACHE_SECONDS = 86400
JWKS_TIMEOUT_SECONDS = 5
CLOCK_LEEWAY_SECONDS = 60


class TokenVerificationUnavailable(Exception):
    """"""


def _issuer() -> str:
    return (
        f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
        f"{settings.aws_cognito_user_pool_id}"
    )


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    return PyJWKClient(
        f"{_issuer()}/.well-known/jwks.json",
        cache_keys=True,
        lifespan=JWKS_CACHE_SECONDS,
        timeout=JWKS_TIMEOUT_SECONDS,
    )


def prefetch_jwks() -> bool:
    if not settings.aws_cognito_user_pool_id:
        logger.error("AWS_COGNITO_USER_POOL_ID is not set, tokens cannot be verified locally")
        return False

    try:
        _jwk_client().get_signing_keys()
    except Exception as exc:
        logger.error("could not fetch the cognito jwks at startup: %s", exc)
        return False

    return True


def _rejected() -> AppError:
    return AppError(
        401,
        "TOKEN_EXPIRED",
        "invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_access_token(token: str) -> dict[str, Any]:
    if not settings.aws_cognito_user_pool_id:
        raise TokenVerificationUnavailable("AWS_COGNITO_USER_POOL_ID is not set")

    try:
        # an unknown kid surfaces here too, and that is the symptom of a wrong pool id
        signing_key = _jwk_client().get_signing_key_from_jwt(token).key
    except jwt.exceptions.PyJWKClientError as exc:
        raise TokenVerificationUnavailable(f"could not resolve the signing key: {exc}") from exc

    claims: dict[str, Any]
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=_issuer(),
            leeway=CLOCK_LEEWAY_SECONDS,
            options={"verify_aud": False, "require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError:
        raise _rejected() from None

    if claims.get("token_use") != "access":
        raise _rejected()

    if claims.get("client_id") != settings.aws_cognito_client_id:
        logger.warning(
            "access token was minted by a different app client than AWS_COGNITO_CLIENT_ID"
        )
        raise TokenVerificationUnavailable("token was minted by a different app client")

    return claims
