
from pydantic import BaseModel


class WatchListRequest(BaseModel):
    ticker: str
