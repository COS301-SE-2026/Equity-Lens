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
    ticker: str
    sector: str
    quantity: Decimal
    total_cost: Decimal
    cost_price: Decimal
    weight_percentage: Decimal

class InstrumentPurchasesAndSalesRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    transaction_name: str
    instrument_name: str
    ticker: str
    sector: str
    price: Decimal
    quantity: Decimal
    value_zar: Decimal

class ContributionsAndWithdrawalsRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    settlement_date: date
    transaction_name: str
    value_zar: Decimal

class DividendsAndWithholdingTaxRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    instrument_name: str
    ticker: str
    sector: str
    gross_dividend: Decimal
    withholding_tax: Decimal
    net_dividend: Decimal
    tax_rate: Decimal

class TransactionExpensesRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    settlement_date: date
    narrative_name: str
    value_zar: Decimal


