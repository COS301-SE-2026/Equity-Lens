
from pydantic import BaseModel


class IndicatorValue(BaseModel):
    status: str
    value: float | None = None
    unit: str | None = None
    reason: str | None = None


class IndicatorRow(BaseModel):
    ticker: str | None = None
    name: str | None = None
    live_fetch: bool
    capm: IndicatorValue
    pe_ratio: IndicatorValue
    altman_z: IndicatorValue
    beta: IndicatorValue
    rsi: IndicatorValue
    sharpe: IndicatorValue
    sortino: IndicatorValue
    error: str | None = None


IndicatorRows = list[IndicatorRow]
