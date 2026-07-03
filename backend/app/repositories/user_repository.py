from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from app.models.user import User

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_user(self, email: str, hashed_password: str, full_name: str) -> User:
        user = User(id=uuid4(), email=email, hashed_password=hashed_password, full_name=full_name)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        return self.db.query(User).filter(User.cognito_sub == cognito_sub).first()

    def get_or_create_cognito_user(self, cognito_sub: str, email: str, full_name: str) -> User:
        user = self.get_by_cognito_sub(cognito_sub)
        if user:
            return user
        
        user = self.get_by_email(email)
        if user:
            user.cognito_sub = cognito_sub
            self.db.commit()
            self.db.refresh(user)
            return user

        user = User(id=uuid4(), email=email, hashed_password=None, full_name=full_name, cognito_sub=cognito_sub)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def user_exists(self, email: str) -> bool:
        return self.db.query(User.id).filter(User.email == email).first() is not None