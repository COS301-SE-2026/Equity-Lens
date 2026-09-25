from typing import List, Optional

from pydantic import BaseModel


class ImportSummary(BaseModel):
    PortfolioValue: float
    TotalHoldings: int
    TotalPurchasesAndSales: float
    TotalTransactionCosts: float
    TotalContributionsAndWithdrawals: float
    TotalDividendsAndWithholdingTax: float
    TotalTransactionInterest: float
    TotalTransactionExpenses: float


class NamedValue(BaseModel):
    name: Optional[str] = None
    value: float


class AllocationSlice(BaseModel):
    name: Optional[str] = None
    weight_percentage: float


class DividendIncomeRow(BaseModel):
    name: Optional[str] = None
    gross_dividend: float
    withholding_tax: float
    net_dividend: float


NamedValueList = List[NamedValue]
