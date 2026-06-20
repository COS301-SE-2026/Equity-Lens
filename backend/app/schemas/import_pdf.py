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

class InstrumentPurchasesandSalesRequest(BaseModel):
    portfolio_id: str
    transactions_date: date
    transaction_type_id: UUID
    instrument_type_id: UUID
    price: Decimal
    quantity: Decimal
    transactions_cost: Decimal
    Value_Zar: Decimal

class TransactionCostsRequest(BaseModel):
    portfolio_id: str
    transaction_type_id: UUID
    Brokerage: Decimal
    Other_Trading_Costs: Decimal

class ContributionsandWithdrawalsRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    Settlement_Date: date
    transaction_type_id: UUID
    value_ZAR: Decimal

class DividendsandWithholdingTaxRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    instrument_type_id: UUID
    Gross_dividend: Decimal
    Withholding_tax: Decimal
    Net_dividend: Decimal
    Tax_rate: Decimal

class transactionInterestRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    Settlement_Date: date
    transaction_type_id: UUID
    instrument_type_id: UUID
    value_ZAR: Decimal

class transactionExpensesRequest(BaseModel):
    portfolio_id: str
    transaction_date: date
    Settlement_Date: date
    transaction_type_id: UUID
    narrative: str
    value_ZAR: Decimal


