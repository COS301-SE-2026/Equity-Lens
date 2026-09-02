from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from decimal import Decimal
from uuid import UUID

from app.schemas.portfolio import normalize_account_type

class ImportPdfRequest(BaseModel):
    file_name: str

class PortfolioRequest(BaseModel):
    document_id: str
    account_number: str
    portfolio_name: str
    currency: str = "ZAR"
    statement_start_date: Optional[date] = None
    statement_end_date: date
    account_type: str

    @field_validator("account_type")
    @classmethod
    def check_known_account_type(cls, v):
        return normalize_account_type(v)

class HoldingsRequest(BaseModel):
    portfolio_id: UUID
    instrument_name: str
    ticker: str
    sector: str
    quantity: Decimal
    total_cost: Decimal
    cost_price: Decimal
    weight_percentage: Decimal
    statement_price: Optional[Decimal] = None
    statement_value: Optional[Decimal] = None

class InstrumentPurchasesAndSalesRequest(BaseModel):
    portfolio_id: UUID
    transaction_date: date
    transaction_name: str
    instrument_name: str
    ticker: str
    sector: str
    price: Decimal
    quantity: Decimal
    value_zar: Decimal

class ContributionsAndWithdrawalsRequest(BaseModel):
    portfolio_id: UUID
    transaction_date: date
    settlement_date: date
    transaction_name: str
    value_zar: Decimal

class DividendsAndWithholdingTaxRequest(BaseModel):
    portfolio_id: UUID
    transaction_date: date
    instrument_name: str
    ticker: str
    sector: str
    gross_dividend: Decimal
    withholding_tax: Decimal
    net_dividend: Decimal
    tax_rate: Decimal

class TransactionExpensesRequest(BaseModel):
    portfolio_id: UUID
    transaction_date: date
    settlement_date: date
    narrative_name: str
    value_zar: Decimal


