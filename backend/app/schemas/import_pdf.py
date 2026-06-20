from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal
from uuid import UUID

class ImportPdfRequest(BaseModel):
    file_name: str
    document_text: str
    password: str

class PortfolioRequest(BaseModel):
    document_id: str
    account_number: str
    portfolio_name: str
    

class HoldingsRequest(BaseModel):
    portfolio_id: str
    instrument_name: str
    quantity: Decimal
    total_cost: Decimal
    cost_price: Decimal
    current_price: Decimal
    current_value: Decimal
    weight_percentage: Decimal

class InstrumentPurchasesAndSalesRequest(BaseModel):
    portfolio_id: str
    transactions_date: date
    transaction_type_id: UUID
    instrument_type_id: UUID
    price: Decimal
    quantity: Decimal
    transactions_cost: Decimal
    value_zar: Decimal

class TransactionCostsRequest(BaseModel):
    portfolio_id: str
    transaction_type_id: UUID
    brokerage: Decimal
    other_trading_costs: Decimal

class ContributionsAndWithdrawalsRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    settlement_date: date
    transaction_type_id: UUID
    value_zar: Decimal

class DividendsAndWithholdingTaxRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    instrument_type_id: UUID
    gross_dividend: Decimal
    withholding_tax: Decimal
    net_dividend: Decimal
    tax_rate: Decimal

class TransactionInterestRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    settlement_date: date
    transaction_type_id: UUID
    instrument_type_id: UUID
    value_zar: Decimal

class TransactionExpensesRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    settlement_date: date
    transaction_type_id: UUID
    narrative: str
    value_zar: Decimal


