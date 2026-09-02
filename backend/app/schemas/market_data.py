from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID


class CurrentPriceParams(BaseModel):
    symbol: str = Field(..., description="Stock symbol, e.g. AAPL", json_schema_extra={"example": "AAPL"})

class HistoryParams(BaseModel):
    symbol: str = Field(..., description="Stock symbol, e.g. AAPL", json_schema_extra={"example": "AAPL"})
    period: Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"] = Field(default="1mo", json_schema_extra={"example": "1mo"})


class SearchParams(BaseModel):
    query: str = Field(..., min_length=1, description="Search keyword, e.g. 'Apple'", json_schema_extra={"example": "Apple"},)

class CurrentPriceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique record identifier")
    ticker: str = Field(..., description="Stock ticker", json_schema_extra={"example": "AAPL"})
    price: float = Field(..., description="Current price", json_schema_extra={"example": 182.50})
    volume: int = Field(..., description="Trading volume", json_schema_extra={"example": 52300100})
    change_percent: Optional[float] = Field(
        None, description="Price change percentage", json_schema_extra={"example": 1.25}
    )
    fetched_at: datetime = Field(..., description="Fetch timestamp")

class HistoryDataPoint(BaseModel):
    date: datetime
    open: float
    high: float
    low: float
    close: float
    prev_close: Optional[float] = None
    volume: int

class HistoryResponse(BaseModel):
    symbol: str = Field(..., json_schema_extra={"example": "AAPL"})
    period: str = Field(..., json_schema_extra={"example": "1mo"})
    data: List[HistoryDataPoint]

class SearchResultItem(BaseModel):
    symbol: str = Field(..., json_schema_extra={"example": "AAPL"})
    name: str = Field(..., json_schema_extra={"example": "Apple Inc."})

class SearchResponse(BaseModel):
    query: str = Field(..., json_schema_extra={"example": "Apple"})
    results: List[SearchResultItem]

class IndicatorRowResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    ticker: str = Field(..., description="Stock ticker", json_schema_extra={"example": "AAPL"})
    name: str = Field(..., description="Instrument name", json_schema_extra={"example": "Apple Inc."})
    status: str = Field(..., description="Data status, e.g., 'ok' or 'insufficient_data'", json_schema_extra={"example": "ok"})
    live_fetch: bool = Field(..., description="Whether live fetch was executed")