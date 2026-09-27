from datetime import UTC, datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    health_preset_key = Column(String(40), nullable=True)
    health_config = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self):
        return f"<UserPreference user={self.user_id} preset={self.health_preset_key}>"
