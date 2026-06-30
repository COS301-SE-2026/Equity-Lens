from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class CurrentPriceParams(BaseModel):
    
    symbol: str = Field(..., description="Stock symbol, e.g. AAPL", example="AAPL")

class HistoryParams(BaseModel):
    symbol: str = Field(..., description="Stock symbol, e.g. AAPL")
    period: str = Field("1mo", description="Data period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max")

    @field_validator("period")
    @classmethod
    def validate_period(cls, v):
        valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']
        if v not in valid_periods:
            raise ValueError(f"period must be one of {valid_periods}")
        return v

class SearchParams(BaseModel):
    
    query: str = Field(..., min_length=1, description="Search keyword, e.g. 'Apple'")

class CurrentPriceResponse(BaseModel):
    id: UUID
    ticker: str
    price: float
    volume: int
    change_percent: Optional[float] = None
    fetched_at: datetime

    class Config:
        from_attributes = True

class HistoryDataPoint(BaseModel):
    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

class HistoryResponse(BaseModel):
    symbol: str
    period: str
    data: List[HistoryDataPoint]

class SearchResultItem(BaseModel):
    symbol: str
    name: str

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]