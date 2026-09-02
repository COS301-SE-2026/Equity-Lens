from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime


class RegisterRequest(BaseModel):
    full_name: str = Field(examples=["Thabo Mokoena"])
    email: EmailStr = Field(
        description="doubles as the Cognito username, so it cannot be changed later",
        examples=["thabo.mokoena@example.co.za"],
    )
    password: str = Field(
        description=(
            "at least 8 characters with an uppercase letter, a lowercase letter, a digit "
            "and a special character. Cognito applies its own policy on top of this one"
        ),
        examples=["Sandton2026!"],
    )

    @field_validator("full_name")
    @classmethod
    def name_must_not_be_empty(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")    
        special_chars = set('!@#$%^&*()_+-=[]{}|;:,.<>?/~`@$!%*?&#.')
        if not any(c in special_chars for c in v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*...)")
        return v


class LoginRequest(BaseModel):
    email: EmailStr = Field(examples=["thabo.mokoena@example.co.za"])
    password: str = Field(examples=["Sandton2026!"])


class UserResponse(BaseModel):
    id: UUID = Field(
        description="the EquityLens user id, not the Cognito sub",
        examples=["6f9619ff-8b86-d011-b42d-00cf4fc964ff"],
    )
    email: str = Field(examples=["thabo.mokoena@example.co.za"])
    full_name: str = Field(examples=["Thabo Mokoena"])
    is_active: bool = Field(
        description="false once the account has been deactivated; it can no longer sign in",
        examples=[True],
    )
    created_at: datetime = Field(
        description="when the EquityLens row was created, which is the first sign-in, not "
                    "when the Cognito account was registered",
        examples=["2026-07-14T08:32:11Z"],
    )

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str = Field(examples=["eyJraWQiOiJIS0..."])
    token_type: str = Field(
        default="bearer",
        description="how to send access_token: Authorization: Bearer <access_token>",
        examples=["bearer"],
    )
    user: UserResponse
class RegisterResponse(BaseModel):
    user_sub: str = Field(
        description="Cognito's id for the new account. The EquityLens user id only exists "
                    "after the first authenticated request",
        examples=["a1b2c3d4-5e6f-7081-9abc-def012345678"],
    )
    email: EmailStr = Field(examples=["thabo.mokoena@example.co.za"])


class StatusResponse(BaseModel):
    """confirm, mfa/confirm-setup, logout and DELETE /me all answer with just a status."""

    status: str = Field(
        description="what completed, one word per route",
        examples=["confirmed", "mfa_configured", "logged_out", "deleted"],
    )


class TokenResponse(BaseModel):
    access_token: str = Field(
        description="send as the bearer token on every other route",
        examples=["eyJraWQiOiJIS0..."],
    )
    id_token: str = Field(
        description="carries the profile claims; not accepted as a bearer token",
        examples=["eyJraWQiOiJ4WjRw..."],
    )
    refresh_token: str = Field(
        description="outlives the other two and buys a new access_token",
        examples=["eyJjdHkiOiJKV1Qi..."],
    )


class TotpSecretResponse(BaseModel):
    secret: str = Field(
        description="base32 seed to put in the authenticator app, by QR code or by hand. "
                    "It is shown once and is not retrievable afterwards",
        examples=["JBSWY3DPEHPK3PXP"],
    )
