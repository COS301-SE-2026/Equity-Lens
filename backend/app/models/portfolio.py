import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class TransactionType(Base):
    __tablename__ = "transaction_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    transaction_name = Column(String(100), nullable=False, unique=True)
    transaction_description = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class NarrativeType(Base):
    __tablename__ = "narrative_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    narrative_name = Column(String(100), nullable=False, unique=True)
    narrative_description = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class InstrumentType(Base):
    __tablename__ = "instrument_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    instrument_name = Column(String(100), nullable=False,unique=True)
    instrument_description = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id",ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(100), nullable=False)
    encrypted_file_path = Column(Text, nullable=False)
    encrypted_document_text = Column(Text)
    extracted_password = Column(Text)

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

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Holdings(Base):
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    instrument_name = Column(String(100), nullable=False)
    ticker = Column(String(100), index=True)
    sector = Column(String(100))
    quantity = Column(Numeric(18,4))
    total_cost = Column(Numeric(18,2))
    cost_price = Column(Numeric(18,2))
    current_price = Column(Numeric(18,2))
    current_value = Column(Numeric(18,2))
    weight_percentage = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class InstrumentPurchasesAndSales(Base):
    __tablename__ = "instrument_purchases_and_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    transactions_date = Column(Date)
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_types.id",ondelete="CASCADE"), nullable=False)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_types.id",ondelete="CASCADE"), nullable=False)
    price = Column(Numeric(18,2))
    quantity = Column(Numeric(18,4))
    transactions_cost = Column(Numeric(18,2))
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class TransactionCosts(Base):
    __tablename__ = "transaction_costs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_types.id", ondelete="CASCADE"), nullable=False)
    brokerage = Column(Numeric(18,2))
    other_trading_costs = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class ContributionsAndWithdrawals(Base):
    __tablename__ = "contributions_and_withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    settlement_date = Column(Date)
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_types.id",ondelete="CASCADE"), nullable=False)
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class DividendsAndWithholdingTax(Base):
    __tablename__ = "dividends_and_withholding_tax"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_types.id",ondelete="CASCADE"), nullable=False)
    gross_dividend = Column(Numeric(18,2))
    withholding_tax = Column(Numeric(18,2))
    net_dividend = Column(Numeric(18,2))
    tax_rate = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class TransactionInterest(Base):
    __tablename__ = "transaction_interest"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    settlement_date = Column(Date)
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_types.id",ondelete="CASCADE"), nullable=False)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_types.id",ondelete="CASCADE"), nullable=False)    
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class TransactionExpenses(Base):
    __tablename__ = "transaction_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date)
    settlement_date = Column(Date)
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_types.id",ondelete="CASCADE"), nullable=False)
    narrative_type_id = Column(UUID(as_uuid=True), ForeignKey("narrative_types.id",ondelete="CASCADE"), nullable=False)
    value_zar = Column(Numeric(18,2))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))







