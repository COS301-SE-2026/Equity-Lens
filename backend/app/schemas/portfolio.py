from pydantic import BaseModel, Field, field_validator

ALLOWED_ACCOUNT_TYPES = {"zar", "tfsa", "usd"}

ACCOUNT_TYPE_CURRENCY = {"zar": "ZAR", "tfsa": "ZAR", "usd": "USD"}


def normalize_account_type(value):
    cleaned = value.strip().lower()
    if cleaned not in ALLOWED_ACCOUNT_TYPES:
        raise ValueError(f"account_type must be one of {sorted(ALLOWED_ACCOUNT_TYPES)}")
    return cleaned


class AccountTypeUpdate(BaseModel):
    account_type: str | None = None

    @field_validator("account_type")
    @classmethod
    def check_known_account_type(cls, v):
        if v is None:
            return None
        return normalize_account_type(v)


class SectorInvestmentRequest(BaseModel):
    sector: str = Field(..., examples=["Healthcare"])
