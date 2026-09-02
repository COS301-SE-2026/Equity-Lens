from datetime import date
from typing import List, Optional
from uuid import UUID

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
class PortfolioSummary(BaseModel):
    total_value: float
    total_cost: float
    total_gain_loss: float
    total_gain_loss_pct: float
    num_holdings: int
    daily_change_pct: Optional[float] = None
    daily_change_value: Optional[float] = None


class SectorSlice(BaseModel):
    sector: str
    value: float
    percentage: float


class PerformancePoint(BaseModel):
    date: str
    name: str
    value: float
    benchmark: Optional[float] = None
    twr_index: Optional[float] = None


class PortfolioRow(BaseModel):
    id: UUID
    document_id: Optional[UUID] = None
    portfolio_name: Optional[str] = None
    account_number: Optional[str] = None
    statement_end_date: Optional[date] = None
    statement_start_date: Optional[date] = None
    account_type: Optional[str] = None


class ReturnsResponse(BaseModel):
    portfolio_value: float
    invested_capital: float
    net_contributions: float
    unrealised_gain: float
    realised_gain: float
    total_costs: float
    simple_return_pct: Optional[float] = None
    money_weighted_return_pct: Optional[float] = None
    time_weighted_return_pct: Optional[float] = None
    snapshot_count: int
    history_days: Optional[int] = None
    holdings_count: int
    priced_live_count: int
    priced_count: int


class HealthSubscore(BaseModel):
    key: str
    label: str
    weight: float
    value: float
    detail: str
    target: str
    improvement: str


class HealthScoreResponse(BaseModel):
    score: Optional[float] = None
    label: Optional[str] = None
    subscores: List[HealthSubscore]


class CgtAssumptions(BaseModel):
    tax_year: str
    annual_exclusion: float
    inclusion_rate: float
    cost_basis_method: str


class CgtEstimateResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
    assumptions: CgtAssumptions
    net_unrealised_gain: Optional[float] = None
    taxable_capital_gain: Optional[float] = None
    assessed_capital_loss: Optional[float] = None
    holdings_from_statement_only: List[str]


class AccountTypeResponse(BaseModel):
    portfolio_id: Optional[str] = None
    account_type: Optional[str] = None


class ConcentrationFlag(BaseModel):
    ticker: str
    name: Optional[str] = None
    current_allocation_pct: float
    target_allocation_pct: float
    value_to_reduce: float
    shares_to_sell: float
    risk_band: str
    look_through_note: Optional[str] = None


class ConcentrationResponse(BaseModel):
    flagged: List[ConcentrationFlag]
    health_score: HealthScoreResponse


class HealthConfigValues(BaseModel):
    weight_sector_concentration: float
    weight_single_position: float
    weight_breadth: float
    concentration_low: float
    concentration_high: float
    hhi_well_spread: float
    breadth_target_n: int


class HealthConfigPreset(BaseModel):
    key: str
    name: str
    description: str
    config: HealthConfigValues


class HealthConfigBounds(BaseModel):
    weight_min: float
    weight_max: float
    concentration_pct_min: float
    concentration_pct_max: float
    hhi_target_min: float
    hhi_target_max: float
    breadth_target_min: float
    breadth_target_max: float


class HealthConfigResponse(BaseModel):
    active: HealthConfigValues
    source: str
    preset_key: Optional[str] = None
    derived_preset_key: Optional[str] = None
    default_preset_key: str
    presets: List[HealthConfigPreset]
    bounds: HealthConfigBounds
