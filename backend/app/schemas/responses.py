from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str

UNAUTHORISED = {401: {"model": ErrorResponse, "description": "Missing or invalid bearer token"}}
BAD_REQUEST = {400: {"model": ErrorResponse, "description": "Rejected by the identity provider"}}
CONFLICT = {409: {"model": ErrorResponse, "description": "Email is already registered"}}
INVALID_CREDENTIALS = {401: {"model": ErrorResponse, "description": "Invalid email or password"}}
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
