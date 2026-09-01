import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from botocore.exceptions import ClientError
from app.services import cognito_service as cognito
from app.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_scheme = HTTPBearer()
logger = logging.getLogger(__name__)

class RegisterReq(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class ConfirmReq(BaseModel):
    email: EmailStr
    code: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class MFAChallengeReq(BaseModel):
    session: str
    email: EmailStr
    totp_code: str

class VerifyTOTPReq(BaseModel):
    totp_code: str

class DeleteAccountReq(BaseModel):
    email: EmailStr

@router.post("/register", status_code=201)
def register(req: RegisterReq):
    return cognito.cognito_register(req.full_name, req.email, req.password)

@router.post("/confirm")
def confirm(req: ConfirmReq):
    cognito.cognito_confirm_registration(req.email, req.code)
    return {"status": "confirmed"}

@router.post("/login")
def login(req: LoginReq):
    return cognito.cognito_login(req.email, req.password)

@router.post("/mfa/verify-login")
def verify_mfa_login(req: MFAChallengeReq):
    try:
        return cognito.cognito_respond_to_mfa(req.session, req.email, req.totp_code)
    except Exception:
        raise HTTPException(status_code=400, detail="The MFA not working")

@router.post("/mfa/associate")
def associate_totp(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    secret = cognito.cognito_associate_totp(cred.credentials)
    return {"secret": secret}

@router.post("/mfa/confirm-setup")
def confirm_totp_setup(req: VerifyTOTPReq, cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_verify_totp(cred.credentials, req.totp_code)
    return {"status": "mfa_configured"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_logout(cred.credentials)
    return {"status": "logged_out"}

@router.delete("/me")
def delete_account(
    req: DeleteAccountReq,
    current_user: User = Depends(get_current_user),
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    if req.email.strip().lower() != current_user.email.strip().lower():
        raise HTTPException(status_code=400, detail="email does not match your account")
    # Cognito deletion, only after UserRepository deletion as Cognito is last
    UserRepository(db).delete_account(current_user)

    try:
        cognito.cognito_delete_user(cred.credentials)
    except ClientError:
        logger.error(
            "Cognito deletion failed after DB commit - orphaned cognito_sub: %s",
            current_user.cognito_sub,
        )
        raise HTTPException(status_code=500, detail="Account deletion failed, contact support")
    return {"status": "deleted"}