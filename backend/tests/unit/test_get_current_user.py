from unittest.mock import patch

from fastapi.security import HTTPAuthorizationCredentials

from app.dependencies import get_current_user
from app.services.token_verifier import TokenVerificationUnavailable

CRED = HTTPAuthorizationCredentials(scheme="Bearer", credentials="an.access.token")


def test_a_known_sub_costs_no_aws_call(db_session, test_user):
    with patch("app.dependencies.verify_access_token",
               return_value={"sub": test_user.cognito_sub}), \
         patch("app.dependencies.cognito_get_user") as cognito:
        user = get_current_user(CRED, db_session)

    assert user.id == test_user.id
    cognito.assert_not_called()


def test_the_request_still_succeeds_when_verification_is_unavailable(db_session, test_user):
    # the whole point of the fallback: a misconfigured pool must not lock anyone out
    with patch("app.dependencies.verify_access_token",
               side_effect=TokenVerificationUnavailable("pool id not set")), \
         patch("app.dependencies.cognito_get_user", return_value={
             "sub": test_user.cognito_sub,
             "email": test_user.email,
             "full_name": test_user.full_name,
         }) as cognito:
        user = get_current_user(CRED, db_session)

    assert user.id == test_user.id
    cognito.assert_called_once()


def test_an_identitys_first_request_still_asks_cognito_for_the_email(db_session):
    # a verified sub with no row yet - the access token has no email or name on it
    with patch("app.dependencies.verify_access_token", return_value={"sub": "brand-new-sub"}), \
         patch("app.dependencies.cognito_get_user", return_value={
             "sub": "brand-new-sub",
             "email": "new@example.com",
             "full_name": "New User",
         }) as cognito:
        user = get_current_user(CRED, db_session)

    assert user.email == "new@example.com"
    cognito.assert_called_once()
