from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import jwt

from app.config import guest_mode_available, settings
from app.services.token_verifier import _rejected

GUEST_KID = "guest-v1"
GUEST_ISSUER = "equitylens-guest"
GUEST_AUDIENCE = "equitylens-api"
GUEST_ALGORITHM = "HS256"
CLOCK_LEEWAY_SECONDS = 30


def create_guest_token(user_id, expires_at: datetime) -> str:
    claims = {
        "iss": GUEST_ISSUER,
        "aud": GUEST_AUDIENCE,
        "sub": str(user_id),
        "token_use": "guest",
        "iat": datetime.now(UTC),
        "exp": expires_at,
        "jti": uuid4().hex,
    }
    return jwt.encode(
        claims, settings.guest_token_secret, algorithm=GUEST_ALGORITHM, headers={"kid": GUEST_KID}
    )


def is_guest_token(token: str) -> bool:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        return False
    return header.get("alg") == GUEST_ALGORITHM and header.get("kid") == GUEST_KID


def verify_guest_token(token: str) -> dict[str, Any]:
    if not guest_mode_available():
        raise _rejected()

    try:
        claims = jwt.decode(
            token,
            settings.guest_token_secret,
            algorithms=[GUEST_ALGORITHM],
            issuer=GUEST_ISSUER,
            audience=GUEST_AUDIENCE,
            leeway=CLOCK_LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        raise _rejected() from None

    if claims.get("token_use") != "guest":
        raise _rejected()

    return claims
