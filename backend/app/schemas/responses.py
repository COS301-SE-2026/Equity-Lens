from fastapi import HTTPException
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error_code: str = Field(
        description="stable code to branch on - the wording of detail may change, this will not",
        examples=["INVALID_CREDENTIALS"],
    )
    detail: str = Field(
        description="human-readable message, safe to show the user",
        examples=["invalid email or password"],
    )

STATUS_ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORISED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
}


class AppError(HTTPException):
    def __init__(self, status_code, error_code, detail, headers=None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code


def error(status, code, message, description):
    return {status: {"model": ErrorResponse, "description": description,
                     "content": {"application/json": {
                         "example": {"error_code": code, "detail": message}}}}}

UNAUTHORISED = error(401, "TOKEN_EXPIRED", "invalid or expired token",
                     "Bearer token missing (UNAUTHORISED) or rejected by Cognito "
                     "(TOKEN_EXPIRED)")
BAD_REQUEST = error(400, "BAD_REQUEST", "Invalid parameter value for email",
                    "Rejected by the identity provider, whose own message is passed "
                    "through as detail")
CONFLICT = error(409, "EMAIL_ALREADY_REGISTERED", "email already registered",
                 "Email is already registered")
INVALID_CREDENTIALS = error(401, "INVALID_CREDENTIALS", "invalid email or password",
                            "Invalid email or password")
INVALID_MFA_CODE = error(401, "INVALID_MFA_CODE", "invalid mfa code",
                         "The authenticator code was wrong, or the challenge session expired")
WEAK_PASSWORD = error(422, "WEAK_PASSWORD", "Password did not conform with policy",
                      "Password rejected by Cognito, or the request body failed validation")

def documented(description, example, errors=UNAUTHORISED, **more):
    return {200: {"description": description,
                  "content": {"application/json": {"example": example, **more}}},
            **errors}

def two_states(description, first, second, labels=("available", "unavailable"),
               errors=UNAUTHORISED):
    return {200: {"description": description,
                  "content": {"application/json": {"examples": {
                      labels[0]: {"value": first},
                      labels[1]: {"value": second}}}}},
            **errors}
