import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Date, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id",ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(100), nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Portfolios(Base):
    __tablename__ = "portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    account_number = Column(String(100), nullable=False)
    portfolio_name = Column(String(100), nullable=False)
    statement_end_date = Column(Date)
    statement_start_date = Column(Date)
    currency = Column(String(10), nullable=False, default="ZAR")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    
    __table_args__ = (UniqueConstraint("portfolio_id", "snapshot_date", name="uq_portfolio_snapshot_date"),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)
    total_value = Column(Numeric(18, 2), nullable=False)
    benchmark_value = Column(Numeric(18, 2))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Holdings(Base):
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    instrument_name = Column(String(100))
    ticker = Column(String(100))
    sector = Column(String(100))
    quantity = Column(Numeric(18,4))
    total_cost = Column(Numeric(18,2))
    cost_price = Column(Numeric(18,2))
    weight_percentage = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class InstrumentPurchasesAndSales(Base):
    __tablename__ = "instrument_purchases_and_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    transaction_name = Column(String(100))
    instrument_name = Column(String(100))
    ticker = Column(String(100))
    sector = Column(String(100))
    price = Column(Numeric(18,2))
    quantity = Column(Numeric(18,4))
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class ContributionsAndWithdrawals(Base):
    __tablename__ = "contributions_and_withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    settlement_date = Column(Date)
    transaction_name = Column(String(100))
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class DividendsAndWithholdingTax(Base):
    __tablename__ = "dividends_and_withholding_tax"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    instrument_name = Column(String(100))
    ticker = Column(String(100))
    sector = Column(String(100))
    gross_dividend = Column(Numeric(18,2))
    withholding_tax = Column(Numeric(18,2))
    net_dividend = Column(Numeric(18,2))
    tax_rate = Column(Numeric(18,2))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class TransactionExpenses(Base):
    __tablename__ = "transaction_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    settlement_date = Column(Date)
    narrative_name = Column(String(100))
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id",ondelete="CASCADE"), nullable=False)
  
    ticker = Column(Text)
    company_name = Column(Text)
    sector = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))









