import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Numeric, String, Index, Date
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class MarketData(Base):
    __tablename__ = "market_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticker = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    open = Column(Numeric(14,4), nullable=False)
    high = Column(Numeric(14,4),nullable=False)
    low = Column(Numeric(14,4),nullable=False)
    close = Column(Numeric(14,4),nullable=False)
    prev_close = Column(Numeric(14,4), nullable=False)
    volume = Column(Integer, nullable=False)
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = {
        Index("ix_market_data_ticker_date", "ticker", date),
    }

    def __repr__(self):
        return f"MarketData(id={self.id!r}, ticker={self.ticker!r}, date={self.date!r}, close={self.close!r})"

