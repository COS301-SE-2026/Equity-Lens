from typing import List, Optional

from pydantic import BaseModel


class IndicatorValue(BaseModel):
    status: str
    value: Optional[float] = None
    unit: Optional[str] = None
    reason: Optional[str] = None


class IndicatorRow(BaseModel):
    ticker: Optional[str] = None
    name: Optional[str] = None
    live_fetch: bool
    capm: IndicatorValue
    pe_ratio: IndicatorValue
    altman_z: IndicatorValue
    beta: IndicatorValue
    rsi: IndicatorValue
    sharpe: IndicatorValue
    sortino: IndicatorValue
    error: Optional[str] = None


IndicatorRows = List[IndicatorRow]
