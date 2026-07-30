from unittest.mock import MagicMock, patch
import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.services import cognito_service as cognito

@pytest.fixture()
def cClient():
    client = MagicMock()
    with patch("app.services.cognito_service._get_client", return_value = client):
        yield client


def test_register_returns(cClient):
    cClient.sign_up.return_value = {"UserSub": "sub1"}

    assert cognito.cognito_register("Test user", "test@gmail.com", "Password1!") == {
        "user_sub": "sub1",
        "email": "test@gmail.com"
    }


def test_login_mapping(cClient):
    cClient.initiate_auth.side_effect = ClientError(
        {"Error": {"Code": "NotAuthorizedException", "Message": "no"}}, "InitiateAuth"
    )
    with pytest.raises(HTTPException) as exc:
        cognito.cognito_login("test@gmail.com", "wrong") 

    assert exc.value.status_code == 401
    assert exc.value.detail == "invalid email or password"    