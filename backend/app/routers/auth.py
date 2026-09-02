import logging
from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from botocore.exceptions import ClientError
from app.services import cognito_service as cognito
from app.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    StatusResponse,
    TokenResponse,
    TotpSecretResponse,
    UserResponse,
)
from app.schemas.responses import (
    BAD_REQUEST,
    CONFLICT,
    INVALID_CREDENTIALS,
    INVALID_MFA_CODE,
    UNAUTHORISED,
    WEAK_PASSWORD,
    AppError,
    error,
    two_states,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_scheme = HTTPBearer()
logger = logging.getLogger(__name__)

class ConfirmReq(BaseModel):
    email: EmailStr
    code: str

class MFAChallengeReq(BaseModel):
    session: str
    email: EmailStr
    totp_code: str

class VerifyTOTPReq(BaseModel):
    totp_code: str

class DeleteAccountReq(BaseModel):
    email: EmailStr

@router.post(
    "/register",
    status_code=201,
    summary="Register a new user",
    operation_id="registerUser",
    response_model=RegisterResponse,
    responses={**CONFLICT, **WEAK_PASSWORD, **BAD_REQUEST},
)
def register(req: RegisterRequest):
    return cognito.cognito_register(req.full_name, req.email, req.password)

@router.post(
    "/confirm",
    summary="Confirm a registration code",
    operation_id="confirmRegistration",
    response_model=StatusResponse,
    responses=BAD_REQUEST,
)
def confirm(req: ConfirmReq):
    cognito.cognito_confirm_registration(req.email, req.code)
    return {"status": "confirmed"}

@router.post(
    "/login",
    summary="Log in with email and password",
    operation_id="login",
    responses=two_states(
        "Either an MFA challenge to answer, or the tokens themselves. Tell them apart by "
        "challenge - a string when MFA is required, null once the login is complete. A null "
        "is stripped from a generated example, so it is not visible in the second one below.",
        {"challenge": "SOFTWARE_TOKEN_MFA", "session": "AYABeF...", "email": "you@example.com"},
        {"challenge": None, "access_token": "eyJraWQ...", "id_token": "eyJraWQ...",
         "refresh_token": "eyJjdHk..."},
        labels=("MFA required", "authenticated"),
        errors={**INVALID_CREDENTIALS, **BAD_REQUEST},
    ),
)
def login(req: LoginRequest):
    return cognito.cognito_login(req.email, req.password)

@router.post("/mfa/verify-login", summary="Answer an MFA challenge", operation_id="verifyMfaLogin", response_model=TokenResponse, responses=INVALID_MFA_CODE,
)
def verify_mfa_login(req: MFAChallengeReq):
    return cognito.cognito_respond_to_mfa(req.session, req.email, req.totp_code)

@router.post(
    "/mfa/associate",
    summary="Start authenticator app setup",
    operation_id="associateTotp",
    response_model=TotpSecretResponse,
)
def associate_totp(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    secret = cognito.cognito_associate_totp(cred.credentials)
    return {"secret": secret}

@router.post(
    "/mfa/confirm-setup",
    summary="Finish authenticator app setup",
    operation_id="confirmTotpSetup",
    response_model=StatusResponse,
)
def confirm_totp_setup(req: VerifyTOTPReq, cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_verify_totp(cred.credentials, req.totp_code)
    return {"status": "mfa_configured"}

@router.get(
    "/me",
    summary="Get the signed-in user",
    operation_id="getCurrentUser",
    response_model=UserResponse,
    responses=UNAUTHORISED,
)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post(
    "/logout",
    summary="Sign out of every device",
    operation_id="logout",
    response_model=StatusResponse,
    responses=UNAUTHORISED,
)
def logout(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_logout(cred.credentials)
    return {"status": "logged_out"}

@router.delete(
    "/me",
    summary="Delete the signed-in account",
    operation_id="deleteAccount",
    response_model=StatusResponse,
    responses={
        **UNAUTHORISED,
        **error(400, "EMAIL_MISMATCH", "email does not match your account",
                "The email given does not match the signed-in account"),
        **error(500, "ACCOUNT_DELETION_FAILED", "Account deletion failed, contact support",
                "Cognito deletion failed after the database row was removed"),
    },
)
def delete_account(
    req: DeleteAccountReq,
    current_user: User = Depends(get_current_user),
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    if req.email.strip().lower() != current_user.email.strip().lower():
        raise AppError(400, "EMAIL_MISMATCH", "email does not match your account")
    # Cognito deletion, only after UserRepository deletion as Cognito is last
    UserRepository(db).delete_account(current_user)

    try:
        cognito.cognito_delete_user(cred.credentials)
    except ClientError:
        logger.error(
            "Cognito deletion failed after DB commit - orphaned cognito_sub: %s",
            current_user.cognito_sub,
        )
        raise AppError(500, "ACCOUNT_DELETION_FAILED", "Account deletion failed, contact support")
    return {"status": "deleted"}