from uuid import UUID

from pydantic import BaseModel


class WatchListRequest(BaseModel):
    ticker: str


class WatchListItem(BaseModel):
    id: UUID
    ticker: str
    company_name: str | None = None
    sector: str | None = None
    current_price: float | None = None
    change_percent: float | None = None


class WatchListResponse(BaseModel):
    success: bool
    Message: str
    watchlist: list[WatchListItem]
    highest: dict
    lowest: dict


class WatchListActionResponse(BaseModel):
    success: bool
    Message: str
