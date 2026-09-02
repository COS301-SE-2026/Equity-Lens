from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user_preference import UserPreference

class UserPreferenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: UUID) -> UserPreference | None:
        stmt = select(UserPreference).where(UserPreference.user_id == user_id)
        return self.db.scalars(stmt).first()

    def upsert(self, user_id: UUID, **fields) -> UserPreference:
        preference = self.get(user_id)
        if preference is None:
            preference = UserPreference(user_id=user_id, **fields)
            self.db.add(preference)
            return preference

        for key, value in fields.items():
            setattr(preference, key, value)
        return preference
