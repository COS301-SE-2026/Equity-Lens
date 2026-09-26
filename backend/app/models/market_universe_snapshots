from sqlalchemy import JSON, Column, DateTime, String

from app.database import Base


class MarketUniverseSnapshot(Base):
    __tablename__ = "market_universe_snapshots"

    market = Column(String(8), primary_key=True)
    symbols = Column(JSON, nullable=False)
    built_at = Column(DateTime(timezone=True), nullable=False)