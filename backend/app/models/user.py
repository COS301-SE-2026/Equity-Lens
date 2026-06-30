from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, server_default=text("TRUE"), default=True)
    cognito_sub = Column(String(255), unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc),)
    updated_at = Column(DateTime(timezone=True),nullable=False,server_default=func.now(),default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc),)

    def __repr__(self):
        return f"<User {self.email}>"