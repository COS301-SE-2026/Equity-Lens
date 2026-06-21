import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
class HoldingSource(str, enum.Enum):
    manual = "manual"
    csv = "csv"
    pdf = "pdf"

class Holding(Base):
    __tablename__ = "holdings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    avg_price = Column(Float, nullable=False)
    purchase_date = Column(DateTime, nullable=True)
    currency = Column(String, nullable=False, default="ZAR")
    source = Column(Enum(HoldingSource), nullable=False, default=HoldingSource.manual)
    broker = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", backref="holdings")
    def __repr__(self):
        return f"<Holding id={self.id} ticker={self.ticker} user_id={self.user_id}>"
