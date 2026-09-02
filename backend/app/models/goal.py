import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    goal_type = Column(String(30), nullable=False)  # "retirement" | "wealth_accumulation"
    target_value = Column(Numeric(18, 2), nullable=False)
    target_date = Column(Date, nullable=False)
    target_age = Column(Integer, nullable=True)
    current_age = Column(Integer, nullable=True)
    target_years = Column(Integer, nullable=True)

    monthly_contribution = Column(Numeric(18, 2), nullable=True)
    expected_return_pct = Column(Numeric(6, 3), nullable=True)
    volatility_pct = Column(Numeric(6, 3), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
