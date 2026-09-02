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
    account_type: str | None = Field(
        default=None,
        description="zar, tfsa or usd, case-insensitive. Null clears the setting and the "
                    "TFSA-only figures stop being calculated",
        examples=["tfsa"],
    )

    @field_validator("account_type")
    @classmethod
    def check_known_account_type(cls, v):
        if v is None:
            return None
        return normalize_account_type(v)


class SectorInvestmentRequest(BaseModel):
    sector: str = Field(..., examples=["Healthcare"])
class PortfolioSummary(BaseModel):
    total_value: float = Field(
        description="rand value of every priced holding at the price the dashboard used",
        examples=[9420.0],
    )
    total_cost: float = Field(
        description="what was paid for those holdings, including brokerage",
        examples=[9000.0],
    )
    total_gain_loss: float = Field(
        description="total_value minus total_cost, unrealised only",
        examples=[420.0],
    )
    total_gain_loss_pct: float = Field(
        description="percentage points, so 4.67 means up 4.67%",
        examples=[4.67],
    )
    num_holdings: int = Field(examples=[7])
    daily_change_pct: Optional[float] = Field(
        default=None,
        description="percentage points moved since the previous close. Null when no "
                    "holding has a live price to compare",
        examples=[0.31],
    )
    daily_change_value: Optional[float] = Field(
        default=None,
        description="the same move in rands. Null on the same condition",
        examples=[29.1],
    )


class SectorSlice(BaseModel):
    sector: str = Field(examples=["Financials"])
    value: float = Field(description="rand value held in this sector", examples=[3180.0])
    percentage: float = Field(
        description="percentage points of the book, so the slices sum to 100",
        examples=[33.8],
    )


class PerformancePoint(BaseModel):
    date: str = Field(description="ISO date of the snapshot", examples=["2026-08-05"])
    name: str = Field(description="short label for the chart axis", examples=["Aug 05"])
    value: float = Field(description="rand value of the book that day", examples=[9020.0])
    benchmark: Optional[float] = Field(
        default=None,
        description="the blended benchmark rebased to the same starting rand value. Null "
                    "on days the benchmark could not be fetched",
        examples=[9020.0],
    )
    twr_index: Optional[float] = Field(
        default=None,
        description="time-weighted index starting at 100, so deposits do not read as "
                    "growth. Null when there are fewer than two snapshots to link",
        examples=[100.0],
    )


class PortfolioRow(BaseModel):
    id: UUID = Field(examples=["6f9619ff-8b86-d011-b42d-00cf4fc964ff"])
    document_id: Optional[UUID] = Field(
        default=None,
        description="the imported statement this portfolio came from. Null if it was not "
                    "created by an import",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    portfolio_name: Optional[str] = Field(default=None, examples=["EasyEquities TFSA"])
    account_number: Optional[str] = Field(default=None, examples=["EE-1234567"])
    statement_end_date: Optional[date] = Field(default=None, examples=["2026-07-31"])
    statement_start_date: Optional[date] = Field(default=None, examples=["2026-07-01"])
    account_type: Optional[str] = Field(
        default=None,
        description="zar, tfsa or usd. Null until the user sets it",
        examples=["tfsa"],
    )


class ReturnsResponse(BaseModel):
    portfolio_value: float = Field(
        description="rand value of every holding, priced or not",
        examples=[9420.0],
    )
    invested_capital: float = Field(
        description="cost basis of the holdings still held, so it falls when you sell",
        examples=[9000.0],
    )
    net_contributions: float = Field(
        description="deposits less withdrawals from the statement, which can exceed "
                    "invested_capital when cash is sitting uninvested",
        examples=[10000.0],
    )
    unrealised_gain: float = Field(
        description="paper gain on holdings that have a real price; cost-priced holdings "
                    "are left out so they cannot fake a zero move",
        examples=[420.0],
    )
    realised_gain: float = Field(
        description="locked in by sales, on an average-cost basis",
        examples=[0.0],
    )
    total_costs: float = Field(
        description="brokerage and fees charged over the statement period",
        examples=[57.5],
    )
    simple_return_pct: Optional[float] = Field(
        default=None,
        description="percentage points: unrealised gain over cost, ignoring when the money "
                    "went in. Null when nothing is priced above its cost basis",
        examples=[4.67],
    )
    money_weighted_return_pct: Optional[float] = Field(
        default=None,
        description="percentage points, annualised XIRR over the cash flows, so it also "
                    "reflects the timing of deposits. Null when XIRR does not converge",
        examples=[12.4],
    )
    time_weighted_return_pct: Optional[float] = Field(
        default=None,
        description="percentage points, chain-linked between snapshots with deposits and "
                    "purchases taken out, so it measures the holdings rather than the "
                    "deposits. This is the one to compare against an index. Null with "
                    "fewer than two snapshots",
        examples=[3.1],
    )
    snapshot_count: int = Field(
        description="daily valuations on record; two is the minimum for a time-weighted "
                    "figure",
        examples=[22],
    )
    history_days: Optional[int] = Field(
        default=None,
        description="days since the earliest snapshot. Null when there are none",
        examples=[30],
    )
    holdings_count: int = Field(examples=[7])
    priced_live_count: int = Field(
        description="holdings priced from a live quote today",
        examples=[6],
    )
    priced_count: int = Field(
        description="holdings priced from anything other than cost, so live plus statement "
                    "prices",
        examples=[7],
    )


class HealthSubscore(BaseModel):
    key: str = Field(examples=["sectorConcentration"])
    label: str = Field(examples=["Sector Concentration"])
    weight: float = Field(
        description="fraction of the overall score, not percentage points; the three "
                    "weights sum to 1",
        examples=[0.4],
    )
    value: float = Field(description="this factor scored out of 10", examples=[6.2])
    detail: str = Field(
        description="what the number says about this book right now",
        examples=["Financials is 34% of the book, and the sector HHI is 0.28."],
    )
    target: str = Field(
        description="what full marks would take, in the user's own terms",
        examples=["HHI at or below 0.15 (roughly 7+ evenly-weighted sectors)"],
    )
    improvement: str = Field(
        description="the one move that would raise this factor",
        examples=["Adding exposure outside Financials would bring this HHI down."],
    )


class HealthScoreResponse(BaseModel):
    score: Optional[float] = Field(
        default=None,
        description="structural risk out of 10, weighted from the subscores. Null for an "
                    "empty portfolio, where there is nothing to score",
        examples=[6.8],
    )
    label: Optional[str] = Field(
        default=None,
        description="Excellent, Healthy, Mixed or Needs attention. Null whenever score is",
        examples=["Healthy"],
    )
    subscores: List[HealthSubscore]


class CgtAssumptions(BaseModel):
    tax_year: str = Field(
        description="SARS tax year the figures below come from",
        examples=["2026/27"],
    )
    annual_exclusion: float = Field(
        description="rands of capital gain excluded before the inclusion rate applies",
        examples=[40000.0],
    )
    inclusion_rate: float = Field(
        description="fraction of the remaining gain added to taxable income, not "
                    "percentage points",
        examples=[0.4],
    )
    cost_basis_method: str = Field(examples=["average"])


class CgtEstimateResponse(BaseModel):
    available: bool = Field(
        description="false when the estimate cannot be made; read reason for why",
        examples=[True],
    )
    reason: Optional[str] = Field(
        default=None,
        description="why the estimate is unavailable. Null when it is available",
        examples=["TFSA growth is not taxed"],
    )
    assumptions: CgtAssumptions
    net_unrealised_gain: Optional[float] = Field(
        default=None,
        description="rands of gain that would be realised if everything were sold today",
        examples=[420.0],
    )
    taxable_capital_gain: Optional[float] = Field(
        default=None,
        description="rands left after the annual exclusion and the inclusion rate",
        examples=[0.0],
    )
    assessed_capital_loss: Optional[float] = Field(
        default=None,
        description="rands of loss carried forward instead of a gain. Null when the "
                    "position is a gain",
        examples=[0.0],
    )
    holdings_from_statement_only: List[str] = Field(
        description="tickers priced off the statement rather than live, so their share of "
                    "the estimate is as stale as the statement",
        examples=[["STX40.JO"]],
    )


class AccountTypeResponse(BaseModel):
    portfolio_id: Optional[str] = Field(
        default=None,
        description="null when nothing has been imported yet",
        examples=["6f9619ff-8b86-d011-b42d-00cf4fc964ff"],
    )
    account_type: Optional[str] = Field(
        default=None,
        description="zar, tfsa or usd. Null until the user sets it",
        examples=["tfsa"],
    )


class ConcentrationFlag(BaseModel):
    ticker: str = Field(examples=["SYG500.JO"])
    name: Optional[str] = Field(default=None, examples=["Sygnia Itrix S&P 500 ETF"])
    current_allocation_pct: float = Field(
        description="percentage points of the book in this holding",
        examples=[34.7],
    )
    target_allocation_pct: float = Field(
        description="percentage points the active health config treats as the ceiling",
        examples=[25.0],
    )
    value_to_reduce: float = Field(
        description="rands to sell to reach the target",
        examples=[1830.0],
    )
    shares_to_sell: float = Field(
        description="the same move in units, at the price used to value the holding",
        examples=[19.4],
    )
    risk_band: str = Field(examples=["High"])
    look_through_note: Optional[str] = Field(
        default=None,
        description="warns when an ETF's own top holding is something also held directly. "
                    "Null when there is no overlap to report",
        examples=["This ETF is itself 7% Naspers, which you also hold directly."],
    )


class ConcentrationResponse(BaseModel):
    flagged: List[ConcentrationFlag]
    health_score: HealthScoreResponse


class HealthConfigValues(BaseModel):
    weight_sector_concentration: float = Field(
        description="fraction of the score from sector spread; the three weights sum to 1",
        examples=[0.4],
    )
    weight_single_position: float = Field(
        description="fraction of the score from the largest single holding",
        examples=[0.35],
    )
    weight_breadth: float = Field(
        description="fraction of the score from the effective number of positions",
        examples=[0.25],
    )
    concentration_low: float = Field(
        description="percentage points in one holding where concentration starts counting "
                    "against the score",
        examples=[25.0],
    )
    concentration_high: float = Field(
        description="percentage points in one holding that scores zero on that factor",
        examples=[45.0],
    )
    hhi_well_spread: float = Field(
        description="sector Herfindahl index that earns full marks; 0.15 is roughly seven "
                    "evenly-weighted sectors, and lower means more spread",
        examples=[0.15],
    )
    breadth_target_n: int = Field(
        description="effective positions that earn full marks on breadth",
        examples=[8],
    )


class HealthConfigPreset(BaseModel):
    key: str = Field(examples=["capital_preservation"])
    name: str = Field(examples=["Capital preservation"])
    description: str = Field(
        description="who the preset is for and what it treats as risky",
        examples=["For a book whose job is not to lose money."],
    )
    config: HealthConfigValues


class HealthConfigBounds(BaseModel):
    weight_min: float = Field(examples=[0.05])
    weight_max: float = Field(examples=[0.7])
    concentration_pct_min: float = Field(
        description="percentage points, the floor for both concentration thresholds",
        examples=[10.0],
    )
    concentration_pct_max: float = Field(
        description="percentage points, the ceiling for both concentration thresholds",
        examples=[70.0],
    )
    hhi_target_min: float = Field(examples=[0.05])
    hhi_target_max: float = Field(examples=[0.5])
    breadth_target_min: float = Field(examples=[3.0])
    breadth_target_max: float = Field(examples=[20.0])


class HealthConfigResponse(BaseModel):
    active: HealthConfigValues
    source: str = Field(
        description="where the active config came from: the built-in default, a preset the "
                    "user chose, one derived from their goal, or hand-tuned values",
        examples=["preset"],
    )
    preset_key: Optional[str] = Field(
        default=None,
        description="the preset the user chose. Null when the values are hand-tuned or "
                    "still the default",
        examples=["capital_preservation"],
    )
    derived_preset_key: Optional[str] = Field(
        default=None,
        description="the preset their goal implies, offered as a suggestion. Null when "
                    "there is no goal to derive one from",
        examples=["growth"],
    )
    default_preset_key: str = Field(
        description="what a reset falls back to",
        examples=["equitylens"],
    )
    presets: List[HealthConfigPreset]
    bounds: HealthConfigBounds
