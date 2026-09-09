import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.schemas.responses import AppError
from app.services import token_verifier

POOL_ID = "af-south-1_TESTPOOL"
CLIENT_ID = "test-app-client"

_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def _configured_pool():
    token_verifier._jwk_client.cache_clear()
    with patch.object(settings, "aws_cognito_user_pool_id", POOL_ID), \
         patch.object(settings, "aws_cognito_client_id", CLIENT_ID):
        yield
    token_verifier._jwk_client.cache_clear()


def make_token(key=_key, **overrides):
    now = int(time.time())
    claims = {
        "sub": "cognito-sub-1",
        "iss": token_verifier._issuer(),
        "client_id": CLIENT_ID,
        "token_use": "access",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm="RS256")


def signing_key_is(key):
    return patch.object(
        token_verifier, "_jwk_client",
        return_value=type("Stub", (), {
            "get_signing_key_from_jwt": staticmethod(
                lambda _token: type("K", (), {"key": key.public_key()})
            )
        })(),
    )


def test_a_valid_token_verifies():
    with signing_key_is(_key):
        claims = token_verifier.verify_access_token(make_token())

    assert claims["sub"] == "cognito-sub-1"


def test_a_token_signed_by_someone_else_is_rejected():
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with signing_key_is(_key), pytest.raises(AppError) as caught:
        token_verifier.verify_access_token(make_token(key=other))

    assert caught.value.status_code == 401


def test_an_id_token_is_rejected():
    with signing_key_is(_key), pytest.raises(AppError) as caught:
        token_verifier.verify_access_token(make_token(token_use="id"))

    assert caught.value.status_code == 401


def test_an_expired_token_is_rejected():
    past = int(time.time()) - 7200

    with signing_key_is(_key), pytest.raises(AppError) as caught:
        token_verifier.verify_access_token(make_token(iat=past, exp=past + 3600))

    assert caught.value.status_code == 401

def test_an_unset_pool_id_falls_back():
    with patch.object(settings, "aws_cognito_user_pool_id", None), \
         pytest.raises(token_verifier.TokenVerificationUnavailable):
        token_verifier.verify_access_token("any.token.here")


def test_an_unreachable_jwks_falls_back():
    stub = type("Stub", (), {
        "get_signing_key_from_jwt": staticmethod(
            lambda _token: (_ for _ in ()).throw(
                jwt.exceptions.PyJWKClientConnectionError("jwks unreachable")
            )
        )
    })()

    with patch.object(token_verifier, "_jwk_client", return_value=stub), \
         pytest.raises(token_verifier.TokenVerificationUnavailable):
        token_verifier.verify_access_token(make_token())


def test_a_mismatched_client_id_falls_back():
    with signing_key_is(_key), \
         pytest.raises(token_verifier.TokenVerificationUnavailable):
        token_verifier.verify_access_token(make_token(client_id="some-other-client"))


def test_prefetch_returns_false_instead_of_raising_when_the_fetch_fails():
    stub = type("Stub", (), {
        "get_signing_keys": staticmethod(
            lambda: (_ for _ in ()).throw(ConnectionError("no network"))
        )
    })()

    with patch.object(token_verifier, "_jwk_client", return_value=stub):
        assert token_verifier.prefetch_jwks() is False


def test_prefetch_returns_false_when_the_pool_id_is_unset():
    with patch.object(settings, "aws_cognito_user_pool_id", ""):
        assert token_verifier.prefetch_jwks() is False