
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
    name: str | None = None
    value: float


class AllocationSlice(BaseModel):
    name: str | None = None
    weight_percentage: float


class DividendIncomeRow(BaseModel):
    name: str | None = None
    gross_dividend: float
    withholding_tax: float
    net_dividend: float


NamedValueList = list[NamedValue]
