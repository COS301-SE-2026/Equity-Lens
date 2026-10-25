import logging

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import guest_mode_available, settings
from app.database import get_db
from app.dependencies import get_current_user, guest_forbidden, require_registered_user
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    GuestModeStatusResponse,
    GuestSessionResponse,
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
    GUEST_CAPACITY,
    GUEST_FORBIDDEN,
    GUEST_MODE_DISABLED,
    GUEST_RATE_LIMITED,
    INVALID_CREDENTIALS,
    INVALID_MFA_CODE,
    UNAUTHORISED,
    WEAK_PASSWORD,
    AppError,
    error,
    two_states,
)
from app.services import cognito_service as cognito
from app.services import guest_service
from app.services.guest_token import create_guest_token, is_guest_token
from app.utils.ai_rate_limit import check_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_scheme = HTTPBearer()
logger = logging.getLogger(__name__)

GUEST_CREATE_WINDOW_SECONDS = 600


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
        {
            "challenge": None,
            "access_token": "eyJraWQ...",
            "id_token": "eyJraWQ...",
            "refresh_token": "eyJjdHk...",
        },
        labels=("MFA required", "authenticated"),
        errors={**INVALID_CREDENTIALS, **BAD_REQUEST},
    ),
)
def login(req: LoginRequest):
    return cognito.cognito_login(req.email, req.password)


@router.post(
    "/mfa/verify-login",
    summary="Answer an MFA challenge",
    operation_id="verifyMfaLogin",
    response_model=TokenResponse,
    responses=INVALID_MFA_CODE,
)
def verify_mfa_login(req: MFAChallengeReq):
    return cognito.cognito_respond_to_mfa(req.session, req.email, req.totp_code)


@router.get(
    "/guest",
    summary="Check whether guest mode is on",
    operation_id="getGuestModeStatus",
    response_model=GuestModeStatusResponse,
)
def get_guest_mode_status():
    return {"enabled": guest_mode_available()}


@router.post(
    "/guest",
    status_code=201,
    summary="Start a guest demo session",
    description="Creates a short-lived user with an empty account, ready for the visitor's "
    "own import. The user and everything it owns are deleted when the session ends or expires.",
    operation_id="startGuestSession",
    response_model=GuestSessionResponse,
    responses={
        **GUEST_MODE_DISABLED,
        **GUEST_RATE_LIMITED,
        **GUEST_CAPACITY,
    },
)
def start_guest_session(request: Request, db: Session = Depends(get_db)):
    if not guest_mode_available():
        raise AppError(404, "GUEST_MODE_DISABLED", "guest mode is not available")

    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "")
    allowed, retry_after = check_limit(
        f"guest-create:{ip}", settings.guest_create_per_ip, GUEST_CREATE_WINDOW_SECONDS
    )
    if not allowed:
        raise AppError(
            429,
            "GUEST_RATE_LIMITED",
            "too many guest sessions from this network, try again later",
            headers={"Retry-After": str(retry_after)},
        )

    user, expires_at = guest_service.start_guest(db)
    return {
        "access_token": create_guest_token(user.id, expires_at),
        "token_type": "bearer",
        "expires_at": expires_at,
        "user": {"id": user.id, "full_name": user.full_name, "is_guest": True},
    }


@router.delete(
    "/guest",
    summary="End the guest demo session",
    operation_id="endGuestSession",
    response_model=StatusResponse,
    responses={
        **UNAUTHORISED,
        **error(403, "FORBIDDEN", "only a guest session can be ended", "Not a guest"),
    },
)
def end_guest_session(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    guest_service.end_guest(db, current_user)
    return {"status": "ended"}


@router.post(
    "/mfa/associate",
    summary="Start authenticator app setup",
    operation_id="associateTotp",
    response_model=TotpSecretResponse,
    responses=GUEST_FORBIDDEN,
)
def associate_totp(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    # a guest has no cognito user, so the token must never reach cognito
    if is_guest_token(cred.credentials):
        raise guest_forbidden()
    secret = cognito.cognito_associate_totp(cred.credentials)
    return {"secret": secret}


@router.post(
    "/mfa/confirm-setup",
    summary="Finish authenticator app setup",
    operation_id="confirmTotpSetup",
    response_model=StatusResponse,
    responses=GUEST_FORBIDDEN,
)
def confirm_totp_setup(
    req: VerifyTOTPReq, cred: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    if is_guest_token(cred.credentials):
        raise guest_forbidden()
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
    if current_user.is_guest:
        # the synthetic address only exists to fill the unique column, so it is never shown
        return UserResponse.model_validate(current_user).model_copy(update={"email": ""})
    return current_user


@router.post(
    "/logout",
    summary="Sign out of every device",
    operation_id="logout",
    response_model=StatusResponse,
    responses=UNAUTHORISED,
)
def logout(
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)
):
    if is_guest_token(cred.credentials):
        # signing a guest out is the same as ending the session: its data goes with it
        guest_service.end_guest(db, get_current_user(cred, db))
        return {"status": "logged_out"}

    cognito.cognito_logout(cred.credentials)
    return {"status": "logged_out"}


@router.delete(
    "/me",
    summary="Delete the signed-in account",
    operation_id="deleteAccount",
    response_model=StatusResponse,
    responses={
        **UNAUTHORISED,
        **GUEST_FORBIDDEN,
        **error(
            400,
            "EMAIL_MISMATCH",
            "email does not match your account",
            "The email given does not match the signed-in account",
        ),
        **error(
            500,
            "ACCOUNT_DELETION_FAILED",
            "Account deletion failed, contact support",
            "Cognito deletion failed after the database row was removed",
        ),
    },
)
def delete_account(
    req: DeleteAccountReq,
    current_user: User = Depends(require_registered_user),
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    if req.email.strip().lower() != current_user.email.strip().lower(): # type: ignore[union-attr]  # email is NOT NULL in the DB
        raise AppError(400, "EMAIL_MISMATCH", "email does not match your account")
    # Cognito deletion, only after UserRepository deletion as Cognito is last
    UserRepository(db).delete_account(current_user)

    try:
        cognito.cognito_delete_user(cred.credentials)
    except ClientError as e:
        logger.error(
            "Cognito deletion failed after DB commit - orphaned cognito_sub: %s",
            current_user.cognito_sub,
        )
        raise AppError(500, "ACCOUNT_DELETION_FAILED", 
                       "Account deletion failed, contact support") from e
    return {"status": "deleted"}
