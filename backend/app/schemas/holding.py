from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

class HoldingSourceEnum(str, Enum):
    manual = "manual"
    csv = "csv"
    pdf = "pdf"

class HoldingCreate(BaseModel):
    ticker: str
    name: str
    sector: str | None = None
    quantity: int = Field(..., gt=0)
    avg_price: float = Field(..., gt=0)
    purchase_date: datetime | None = None
    currency: str = "ZAR"
    source: HoldingSourceEnum = HoldingSourceEnum.manual
    broker: str | None = None

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ticker cannot be blank")
        return v.strip().upper()

class HoldingUpdate(BaseModel):
    quantity: int | None = Field(None, gt=0)
    avg_price: float | None = Field(None, gt=0)
    sector: str | None = None
    broker: str | None = None

class HoldingResponse(BaseModel):
    id: UUID
    user_id: UUID
    ticker: str
    name: str
    sector: str | None
    quantity: int
    avg_price: float
    purchase_date: datetime | None
    currency: str
    source: HoldingSourceEnum
    broker: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}