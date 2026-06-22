import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.config import settings


def _get_client():
    return boto3.client(
        "cognito-idp",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def cognito_register(full_name: str, email: str, password: str) -> dict:
    client = _get_client()
    try:
        res = client.sign_up(
            ClientId=settings.aws_cognito_client_id,
            Username=email,
            Password=password,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": full_name},
            ],
        )
        return {"user_sub": res["UserSub"], "email": email}
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = e.response["Error"]["Message"]
        
        if code == "UsernameExistsException":
            raise HTTPException(status_code=409, detail="email already registered")
        if code == "InvalidPasswordException":
            raise HTTPException(status_code=422, detail=msg)
            
        raise HTTPException(status_code=400, detail=msg)


def cognito_confirm_registration(email: str, code: str) -> bool:
    client = _get_client()
    try:
        client.confirm_sign_up(
            ClientId=settings.aws_cognito_client_id,
            Username=email,
            ConfirmationCode=code,
        )
        return True
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])


def cognito_login(email: str, password: str) -> dict:
    client = _get_client()
    try:
        res = client.initiate_auth(
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": email, "PASSWORD": password},
            ClientId=settings.aws_cognito_client_id,
        )

        challenge = res.get("ChallengeName")
        if challenge in ("SOFTWARE_TOKEN_MFA", "MFA_SETUP"):
            return {
                "challenge": challenge,
                "session": res["Session"],
                "email": email,
            }

        tokens = res["AuthenticationResult"]
        return {
            "challenge": None,
            "access_token": tokens["AccessToken"],
            "id_token": tokens["IdToken"],
            "refresh_token": tokens["RefreshToken"],
        }
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NotAuthorizedException", "UserNotFoundException"):
            raise HTTPException(
                status_code=401,
                detail="invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])


def cognito_respond_to_mfa(session: str, email: str, totp_code: str) -> dict:
    client = _get_client()
    try:
        res = client.respond_to_auth_challenge(
            ClientId=settings.aws_cognito_client_id,
            ChallengeName="SOFTWARE_TOKEN_MFA",
            Session=session,
            ChallengeResponses={
                "USERNAME": email,
                "SOFTWARE_TOKEN_MFA_CODE": totp_code,
            },
        )
        tokens = res["AuthenticationResult"]
        return {
            "access_token": tokens["AccessToken"],
            "id_token": tokens["IdToken"],
            "refresh_token": tokens["RefreshToken"],
        }
    except ClientError:
        raise HTTPException(
            status_code=401,
            detail="invalid mfa code",
            headers={"WWW-Authenticate": "Bearer"},
        )


def cognito_associate_totp(access_token: str) -> str:
    client = _get_client()
    try:
        res = client.associate_software_token(AccessToken=access_token)
        return res["SecretCode"]
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])


def cognito_verify_totp(access_token: str, totp_code: str) -> bool:
    client = _get_client()
    try:
        client.verify_software_token(
            AccessToken=access_token,
            UserCode=totp_code,
            FriendlyDeviceName="EquityLens App",
        )
        client.set_user_mfa_preference(
            AccessToken=access_token,
            SoftwareTokenMfaSettings={"Enabled": True, "PreferredMfa": True},
        )
        return True
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])


def cognito_get_user(access_token: str) -> dict:
    client = _get_client()
    try:
        res = client.get_user(AccessToken=access_token)
        attrs = {a["Name"]: a["Value"] for a in res["UserAttributes"]}
        return {
            "sub": attrs.get("sub"),
            "email": attrs.get("email"),
            "full_name": attrs.get("name", ""),
            "email_verified": attrs.get("email_verified") == "true",
        }
    except ClientError:
        raise HTTPException(
            status_code=401,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def cognito_logout(access_token: str) -> bool:
    try:
        _get_client().global_sign_out(AccessToken=access_token)
    except ClientError:
        pass 
    return True