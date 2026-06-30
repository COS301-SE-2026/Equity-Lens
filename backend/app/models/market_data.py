import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class MarketData(Base):
    __tablename__ = "market_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticker = Column(String, nullable= False)
    price = Column(Numeric(14,4), nullable= False)
    volume = Column(Integer, nullable=False)
    change_percent = Column(Numeric(6,4))
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"MarketData(id={self.id!r}, ticker={self.ticker!r}, price={self.price})"

