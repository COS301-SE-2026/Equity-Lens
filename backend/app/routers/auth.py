from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from app.services import cognito_service as cognito
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_scheme = HTTPBearer()

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
    return cognito.cognito_respond_to_mfa(req.session, req.email, req.totp_code)

@router.post("/mfa/associate")
def associate_totp(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    secret = cognito.cognito_associate_totp(cred.credentials)
    return {"secret": secret}

@router.post("/mfa/confirm-setup")
def confirm_totp_setup(req: VerifyTOTPReq, cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_verify_totp(cred.credentials, req.totp_code)
    return {"status": "mfa_configured"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(cred: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    cognito.cognito_logout(cred.credentials)
    return {"status": "logged_out"}