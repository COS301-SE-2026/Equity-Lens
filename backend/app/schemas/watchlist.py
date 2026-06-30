from pydantic import BaseModel
from uuid import UUID

class WatchListRequest(BaseModel):
    ticker: str
    company_name: str
    sector: str
