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

def test_delete_user_calls_client_with_access_token(cClient):
    cClient.delete_user.return_value = {}

    result = cognito.cognito_delete_user("some-access-token")

    cClient.delete_user.assert_called_once_with(AccessToken="some-access-token")
    assert result is None


def test_delete_user_treats_user_not_found_as_success(cClient):
    cClient.delete_user.side_effect = ClientError(
        {"Error": {"Code": "UserNotFoundException", "Message": "no such user"}}, "DeleteUser"
    )

    result = cognito.cognito_delete_user("some-access-token")

    cClient.delete_user.assert_called_once_with(AccessToken="some-access-token")
    assert result is None


def test_delete_user_propagates_other_client_errors(cClient):
    cClient.delete_user.side_effect = ClientError(
        {"Error": {"Code": "InternalErrorException", "Message": "boom"}}, "DeleteUser"
    )

    with pytest.raises(ClientError) as exc:
        cognito.cognito_delete_user("some-access-token")

    assert exc.value.response["Error"]["Code"] == "InternalErrorException"