from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

class WatchListRequest(BaseModel):
    ticker: str
class WatchListItem(BaseModel):
    id: UUID
    ticker: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    current_price: Optional[float] = None
    change_percent: Optional[float] = None

class WatchListResponse(BaseModel):
    success: bool
    Message: str
    watchlist: List[WatchListItem]
    highest: dict
    lowest: dict

class WatchListActionResponse(BaseModel):
    success: bool
    Message: str
