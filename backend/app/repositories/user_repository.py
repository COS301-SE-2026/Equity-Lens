from sqlalchemy.orm import Session
from app.models.user import User
import uuid


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_user(self, email: str, hashed_password: str, full_name: str) -> User:
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def user_exists(self, email: str) -> bool:
        return self.db.query(User).filter(User.email == email).first() is not None