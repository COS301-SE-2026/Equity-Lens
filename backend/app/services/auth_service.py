from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from app.utils.exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    TokenExpiredException,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise InvalidCredentialsException()
        return user_id
    except JWTError:
        raise TokenExpiredException()


class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    def register(self, request: RegisterRequest) -> UserResponse:
        if self.repo.user_exists(request.email):
            raise UserAlreadyExistsException()
        hashed = hash_password(request.password)
        user = self.repo.create_user(
            email=request.email,
            hashed_password=hashed,
            full_name=request.full_name,
        )
        return UserResponse.model_validate(user)

    def login(self, request: LoginRequest) -> AuthResponse:
        user = self.repo.get_by_email(request.email)
        if not user or not verify_password(request.password, user.hashed_password):
            raise InvalidCredentialsException()
        token = create_access_token(str(user.id))
        return AuthResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
        )

    def get_user_by_id(self, user_id: str) -> UserResponse:
        import uuid
        user = self.repo.get_by_id(uuid.UUID(user_id))
        if not user:
            from app.utils.exceptions import UserNotFoundException
            raise UserNotFoundException()
        return UserResponse.model_validate(user)