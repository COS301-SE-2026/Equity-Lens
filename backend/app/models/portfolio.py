import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class transaction_type(Base):
    __tablename__ = "transaction_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    transaction_name = Column(String(100), nullable=False)
    transaction_description = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class instrument_type(Base):
    __tablename__ = "instrument_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    instrument_name = Column(String(100), nullable=False)
    instrument_description = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id",ondelete="CASCADE"), nullable=False)

    file_name = Column(String(100), nullable=False)
    encrypted_file_path = Column(Text, nullable=False)
    encrypted_document_text = Column(Text)
    extracted_password = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class portfolios(Base):
    __tablename__ = "portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id",ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id",ondelete="CASCADE"), nullable=False)

    account_number = Column(String(100), nullable=False)
    portfolio_name = Column(String(100), nullable=False)
    statement_end_date = Column(Date)
    statement_start_date = Column(Date)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class holdings(Base):
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

    instrument_name = Column(String(100), nullable=False)
    quantity = Column(Numeric(18,4)),
    total_cost = Column(Numeric(18,2)),
    cost_price = Column(Numeric(18,2)),
    current_price = Column(Numeric(18,2)),
    current_value = Column(Numeric(18,2)),
    weight_percentage = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class Instrument_Purchases_and_Sales(Base):
    __tablename__ = "instrument_purchases_and_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

    transactions_date = Column(Date),
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_type.id",ondelete="CASCADE"), nullable=False)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_type.id",ondelete="CASCADE"), nullable=False)
    price = Column(Numeric(18,2)),
    quantity = Column(Numeric(18,4)),
    transactions_cost = Column(Numeric(18,2)),
    Value_Zar = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class Transaction_Costs(Base):
    __tablename__ = "transaction_costs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_type.id",ondelete="CASCADE"), nullable=False)
    Brokerage = Column(Numeric(18,2)),
    Other_Trading_Costs = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class Contributions_and_Withdrawals(Base):
    __tablename__ = "contributions_and_withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

  
    transaction_date = Column(Date),
    Settlement_Date = Column(Date),
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_type.id",ondelete="CASCADE"), nullable=False)
    value_ZAR = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))

class Dividends_and_Withholding_Tax(Base):
    __tablename__ = "dividends_and_withholding_tax"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

  
    transaction_date = Column(Date),
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_type.id",ondelete="CASCADE"), nullable=False)
    Gross_dividend = Column(Numeric(18,2)),
    Withholding_tax = Column(Numeric(18,2)),
    Net_dividend = Column(Numeric(18,2)),
    Tax_rate = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class transaction_Interest(Base):
    __tablename__ = "transaction_interest"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)

  
    transaction_date = Column(Date),
    Settlement_Date = Column(Date),
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_type.id",ondelete="CASCADE"), nullable=False)
    instrument_type_id = Column(UUID(as_uuid=True), ForeignKey("instrument_type.id",ondelete="CASCADE"), nullable=False)    
    value_ZAR = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))


class transaction_Expenses(Base):
    __tablename__ = "transaction_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id",ondelete="CASCADE"), nullable=False)
  
    transaction_date = Column(Date),
    Settlement_Date = Column(Date),
    transaction_type_id = Column(UUID(as_uuid=True), ForeignKey("transaction_type.id",ondelete="CASCADE"), nullable=False)
    narrative = Column(Text),
    value_ZAR = Column(Numeric(18,2)),

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime,default=lambda: datetime.now(timezone.utc),onupdate=lambda: datetime.now(timezone.utc))







