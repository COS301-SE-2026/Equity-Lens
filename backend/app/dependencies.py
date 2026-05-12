from fastapi import Depends, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth_service import decode_token, AuthService
from app.utils.exceptions import InvalidCredentialsException


async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
    ):
    if not authorization.startswith("Bearer "):
        raise InvalidCredentialsException()
    token = authorization.split(" ")[1]
    user_id = decode_token(token)
    service = AuthService(db)
    return service.get_user_by_id(user_id)