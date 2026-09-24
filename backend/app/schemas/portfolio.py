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


class BenchmarkComponent(BaseModel):
    region: str = Field(description="region key the holding was classified into", examples=["za"])
    label: str = Field(
        description="the index this region is measured against",
        examples=["Satrix 40 (JSE Top 40 proxy)"],
    )
    weight: float = Field(
        description="percentage points of the priced book in this region, after unclassified "
                    "holdings are excluded, so the components sum to 100",
        examples=[72.4],
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


class TaxAnalysisHolding(BaseModel):
    ticker: str = Field(examples=["SYG500.JO"])
    name: str = Field(examples=["Satrix S&P 500"])
    unrealised_gain_loss: float = Field(
        description="rands of gain or loss on this position at today's price",
        examples=[420.0],
    )
    unrealised_gain_loss_pct: Optional[float] = Field(
        default=None,
        description="the same figure against cost. Null when there is no cost to divide into",
        examples=[4.67],
    )


class TaxAnalysisResponse(CgtEstimateResponse):
    holdings: List[TaxAnalysisHolding] = Field(
        description="one row per priced holding. Empty when the estimate is unavailable",
    )
    potential_realised_loss: Optional[float] = Field(
        default=None,
        description="rands sitting in positions currently under water, as a negative number. "
                    "Null when the estimate is unavailable",
        examples=[0.0],
    )
    note: Optional[str] = Field(
        default=None,
        description="the loss-offset caveat. Null when the estimate is unavailable",
        examples=["Realising a loss can offset a capital gain elsewhere in the same tax year"],
    )


class TfsaRoomResponse(BaseModel):
    available: bool = Field(
        description="false when the portfolio is not a TFSA; read reason for why",
        examples=[True],
    )
    reason: Optional[str] = Field(
        default=None,
        description="why the room cannot be reported. Null when it can",
        examples=["not_a_tfsa"],
    )
    tax_year_label: Optional[str] = Field(default=None, examples=["2026/2027"])
    annual_limit: Optional[float] = Field(default=None, examples=[46000.0])
    annual_contributed: Optional[float] = Field(
        default=None,
        description="rands contributed since 1 March, counted from imported statements only",
        examples=[10000.0],
    )
    annual_remaining: Optional[float] = Field(default=None, examples=[36000.0])
    lifetime_limit: Optional[float] = Field(default=None, examples=[500000.0])
    lifetime_contributed: Optional[float] = Field(default=None, examples=[10000.0])
    lifetime_remaining: Optional[float] = Field(default=None, examples=[490000.0])
    note: Optional[str] = Field(
        default=None,
        description="the no-carry-over and no-room-restored caveat",
        examples=["Unused annual room does not carry over to the next tax year"],
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


class MarketContextSector(BaseModel):
    sector: str = Field(examples=["Financials"])
    weight_pct: float = Field(
        description="percentage points of the book held in this sector",
        examples=[33.8],
    )
    priced_weight_pct: float = Field(
        description="how much of that weight had a live price today, in percentage points of "
                    "the sector. 100 means daily_change_pct covers the whole sector, 40 means "
                    "it is the move of the 40% that could be priced",
        examples=[100.0],
    )
    daily_change_pct: float | None = Field(
        default=None,
        description="value-weighted move of the priced holdings in this sector. Null when "
                    "none of them has a live price, which is not the same as a flat day",
        examples=[0.31],
    )
    tickers: list[str] = Field(examples=[["SBK.JO", "FSR.JO"]])
    summary: str = Field(
        description="the same reading in a sentence, including when there is no price to read",
        examples=["Your Financials holdings (SBK.JO, FSR.JO) are up 0.3% today."],
    )


class MarketContextResponse(BaseModel):
    available: bool = Field(
        description="false when nothing is held, so there are no sectors to report",
        examples=[True],
    )
    label: str | None = Field(default=None, examples=["Illustrative market context"])
    sectors: list[MarketContextSector]


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
    shares_to_sell: float | None = Field(
        default=None,
        description="the same move in units, at the price used to value the holding. Null "
                    "when the holding has no usable price to convert rands into units - a "
                    "flagged holding priced at a cost of zero has no share count to quote",
        examples=[19.4],
    )
    risk_band: str = Field(examples=["High"])
    look_through_note: Optional[str] = Field(
        default=None,
        description="warns when an ETF's own top holding is something also held directly. "
                    "Null when there is no overlap to report",
        examples=["This ETF is itself 7% Naspers, which you also hold directly."],
    )


class ConcentrationThresholds(BaseModel):
    concentration_low: float = Field(
        description="percentage points where concentration starts counting against the score",
        examples=[25.0],
    )
    concentration_high: float = Field(
        description="percentage points that scores zero on that factor, and the level a "
                    "sector has to clear before a rebalance is offered",
        examples=[45.0],
    )


class ConcentrationResponse(BaseModel):
    flagged: List[ConcentrationFlag]
    health_score: HealthScoreResponse
    thresholds: ConcentrationThresholds = Field(
        description="the thresholds this response was built with, taken from the user's "
                    "active health config - clients must read the numbers from here rather "
                    "than repeating 25/45 in their own copy",
    )


class HistoryQuality(BaseModel):
    first_day: str | None = Field(
        default=None,
        description="first day every holding could be priced, which is where the series starts. "
                    "Earlier days are not drawn, because a book with a holding missing from it "
                    "reads as growth on the day that holding's prices begin",
        examples=["2026-02-04"],
    )
    priced_value_pct: float = Field(
        default=0.0,
        description="share of the book by value with any price history at all. Below 80 the "
                    "reconstruction writes nothing rather than draw a chart missing a fifth of "
                    "the portfolio",
        examples=[94.2],
    )
    unpriced_tickers: List[str] = Field(
        default_factory=list,
        description="held tickers with no cached prices, named so the gap is attributable",
        examples=[["XYZ.JO"]],
    )
    ledger_conflicts: int | None = Field(
        default=None,
        description="buys larger than the position held after them: the statement's transaction "
                    "list and its closing holdings contradict each other. Null means this load "
                    "did not run a reconstruction, not that there were none",
        examples=[2],
    )
    suspect_dates: List[str] | None = Field(
        default=None,
        description="days a held price moved more than 35% with no transaction to explain it, "
                    "which is usually a share split. Flagged, never adjusted - there is no "
                    "corporate-action data here and a guessed factor would hide the problem",
        examples=[["2026-03-04"]],
    )


class SubscoreDelta(BaseModel):
    key: str = Field(examples=["sectorConcentration"])
    label: str = Field(examples=["Sector Concentration"])
    before: float = Field(
        description="this factor's score out of 10 as the book stands, unrounded",
        examples=[6.8],
    )
    after: float = Field(
        description="the same factor after the simulated move, unrounded",
        examples=[6.5],
    )
    weight: float = Field(
        description="this factor's share of the composite under the user's active config, so a "
                    "client can show which movement actually drove the headline number",
        examples=[0.4],
    )


class SectorInvestmentResponse(BaseModel):
    available: bool = Field(examples=[True])
    reason: str | None = Field(default=None, examples=[None])
    sector: str | None = Field(default=None, examples=["Financials"])
    illustrative_amount: float | None = Field(
        default=None,
        description="rand value of the simulated top-up: 5% of the current book",
        examples=[8374.8],
    )
    current_weight_pct: float | None = Field(default=None, examples=[15.4])
    projected_weight_pct: float | None = Field(default=None, examples=[19.4])
    health_score_before: float | None = Field(default=None, examples=[4.8])
    health_score_after: float | None = Field(default=None, examples=[5.0])
    subscore_deltas: List[SubscoreDelta] = []
    is_smallest_sector: bool | None = Field(default=None, examples=[False])
    explanation: str | None = Field(default=None)
    thresholds: ConcentrationThresholds | None = None
    disclaimer: str | None = Field(default=None)


class SectorRebalanceResponse(BaseModel):
    available: bool = Field(examples=[True])
    reason: str | None = Field(default=None, examples=[None])
    from_sector: str | None = Field(default=None, examples=["Technology"])
    to_sector: str | None = Field(default=None, examples=["Telecommunications"])
    value_shifted: float | None = Field(default=None, examples=[42000.0])
    from_sector_before_pct: float | None = Field(default=None, examples=[62.0])
    to_sector_before_pct: float | None = Field(default=None, examples=[5.2])
    health_score_before: float | None = Field(default=None, examples=[4.8])
    health_score_after: float | None = Field(default=None, examples=[6.1])
    subscore_deltas: List[SubscoreDelta] = []
    explanation: str | None = Field(default=None)
    thresholds: ConcentrationThresholds | None = None
    disclaimer: str | None = Field(default=None)


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


class PortfolioEvent(BaseModel):
    ticker: str = Field(examples=["NPN.JO"])
    name: str | None = Field(default=None, examples=["Naspers"])
    date: str = Field(description="the trading day the move happened", examples=["2026-08-14"])
    return_pct: float = Field(
        description="the day's move in percentage points, from the log return",
        examples=[-7.42],
    )
    z_score: float = Field(
        description="how many standard deviations out the move was, measured against an EWMA "
                    "volatility built only from the days before it",
        examples=[-3.61],
    )
    direction: str = Field(examples=["down"])
    annualised_volatility_pct: float = Field(
        description="the EWMA volatility this move was measured against, annualised. shown "
                    "next to the z-score so the sigma claim can be checked rather than taken",
        examples=[31.4],
    )
    observations: int = Field(
        description="daily returns behind that estimate",
        examples=[246],
    )
    daily_sigma_pct: float = Field(
        description="one normal day's move for this holding, the sigma the z-score divides by",
        examples=[1.86],
    )
    rank_in_period: int = Field(
        description="1 is the largest move in this direction in the period. only moves the same "
                    "way count, so a fall is ranked against falls",
        examples=[1],
    )
    period_days: int = Field(description="daily returns in the period ranked", examples=[246])
    band: str | None = Field(
        default=None,
        description="unusual from 3 sigma, very_unusual from 4, extremely_unusual from 5. null "
                    "under 3, which only happens when k was set below 3",
        examples=["extremely_unusual"],
    )
    times_normal: float = Field(
        description="|z| to one decimal, for 'about 5.8 times a normal day'",
        examples=[5.8],
    )
    has_news: bool = Field(
        default=False,
        description="true when a stored article passes the same test the event panel uses: "
                    "tagged by the provider, in the exchange-local [-3, +1] day window, and "
                    "either a match score of 25+ or the company named in the headline. it was "
                    "set before but missing here, so the response dropped it",
        examples=[True],
    )


class ScannedHolding(BaseModel):
    ticker: str = Field(examples=["NPN.JO"])
    name: str | None = Field(default=None, examples=["Naspers"])
    observations: int = Field(examples=[246])
    annualised_volatility_pct: float = Field(examples=[31.4])


class EventSkip(BaseModel):
    ticker: str = Field(examples=["ABC.JO"])
    reason: str = Field(examples=["insufficient_history"])
    observations: int = Field(
        description="usable daily returns found, against the 60 the detector needs",
        examples=[12],
    )


class BenchmarkDivergence(BaseModel):
    date: str = Field(examples=["2026-01-30"])
    portfolio_return_pct: float = Field(
        description="the day's time-weighted return, so a deposit does not read as a divergence",
        examples=[4.8],
    )
    benchmark_return_pct: float = Field(examples=[0.7])
    relative_return_pct: float = Field(
        description="the gap, as a simple percentage converted back from the log difference "
                    "ln(P_t/P_t-1) - ln(B_t/B_t-1)",
        examples=[4.07],
    )
    z_score: float = Field(
        description="how many standard deviations out this gap was, against an EWMA volatility "
                    "built only from the gaps before it",
        examples=[3.4],
    )
    annualised_volatility_pct: float = Field(
        description="the volatility of the gap itself, annualised - not of the portfolio",
        examples=[9.6],
    )
    observations: int = Field(examples=[214])
    direction: str = Field(description="ahead or behind the benchmark", examples=["ahead"])


class DivergenceScan(BaseModel):
    available: bool = Field(examples=[True])
    reason: str | None = Field(
        default=None,
        description="insufficient_history when there were fewer usable days than the detector "
                    "needs. an empty divergences list cannot say this on its own",
        examples=[None],
    )
    observations: int = Field(examples=[214])


class EventCoverage(BaseModel):
    holdings_total: int = Field(examples=[7])
    holdings_scanned: int = Field(
        description="holdings with enough history to score. the gap to holdings_total is "
                    "listed in holdings_skipped rather than left unsaid",
        examples=[5],
    )
    holdings_skipped: list[EventSkip]
    holdings: list[ScannedHolding] = Field(
        default=[],
        description="every holding that was scored, with the volatility estimate behind it",
    )
    events_found: int = Field(examples=[31])
    events_returned: int = Field(description="capped at 20", examples=[20])
    divergence_scan: DivergenceScan | None = None
    scored_days_total: int = Field(
        description="days actually scored across every scanned holding, seed days excluded",
        examples=[1080],
    )
    expected_by_chance: float = Field(
        description="how many events that many days would give by chance alone: "
                    "scored_days_total * erfc(k / sqrt(2))",
        examples=[2.9],
    )
    chance_note: str = Field(
        examples=["if daily moves were normally distributed; real returns have fatter tails, "
                  "so expect more"],
    )
    news_last_collected_at: str | None = Field(
        default=None,
        description="when the last nightly or backfill run that stored news finished, UTC. this "
                    "response is cached for 15 minutes, so it can lag a run by that much",
        examples=["2026-09-25T00:41:12Z"],
    )
    news_last_run_status: str | None = Field(
        default=None,
        description="ok, partial or failed - the most recent nightly or backfill run, which may "
                    "be newer than the collection date above if it failed",
        examples=["ok"],
    )


class PortfolioEventsResponse(BaseModel):
    period: str = Field(examples=["1y"])
    k_sigma: float = Field(description="the threshold used", examples=[3.0])
    events: list[PortfolioEvent]
    divergences: list[BenchmarkDivergence] = Field(
        default=[],
        description="portfolio-level days, scored the same way and capped the same way as the "
                    "per-holding events above",
    )
    coverage: EventCoverage


class AbnormalReturn(BaseModel):
    date: str = Field(examples=["2026-08-14"])
    offset: int = Field(description="trading days from the event, 0 is the event", examples=[0])
    stock_return_pct: float = Field(description="simple return, P_t / P_t-1 - 1", examples=[-7.42])
    market_return_pct: float = Field(examples=[-0.31])
    abnormal_return_pct: float = Field(
        description="the day's simple return less beta times the market's. alpha is not taken "
                    "off",
        examples=[-7.05],
    )
    cumulative_abnormal_return_pct: float = Field(examples=[-7.05])
    car_lower_pct: float = Field(description="95% band on the cumulative figure", examples=[-9.1])
    car_upper_pct: float = Field(examples=[-5.0])
    significant: bool = Field(
        description="true when the cumulative abnormal return sits outside its own band",
        examples=[True],
    )


class EventWindow(BaseModel):
    from_: str = Field(alias="from", examples=["2026-08-07"])
    to: str = Field(examples=["2026-08-28"])
    length: int = Field(examples=[16])


class EstimationWindow(BaseModel):
    from_: str = Field(alias="from", examples=["2026-02-19"])
    to: str = Field(examples=["2026-07-17"])
    offsets: list[int] = Field(examples=[[-120, -21]])


class ExplanationScores(BaseModel):
    bm25: float = Field(examples=[4.81])
    bm25_normalised: float = Field(
        description="bm25 over the sum of the query terms' idf, capped at 1 - so 1.0 is an "
                    "average-length article using every query term once, not just the best "
                    "of whatever was found",
        examples=[0.62],
    )
    date_proximity: float = Field(examples=[0.8825])
    entity_match: float = Field(
        description="1.0 when the headline names the company, 0.5 when only the provider's "
                    "entity tag does",
        examples=[1.0],
    )
    combined: float = Field(
        description="0.5 bm25_normalised + 0.3 date_proximity + 0.2 entity_match. orders the "
                    "list, it is not a probability",
        examples=[0.8748],
    )


class ExplanationEvidence(BaseModel):
    named_in_headline: bool = Field(examples=[True])
    provider_match_score: float | None = Field(
        default=None,
        description="marketaux's own match score for this company in this article. unbounded: "
                    "passing mentions sit in the teens, articles about the company above 30",
        examples=[50.3],
    )
    days_from_event: int = Field(
        description="in the exchange's own calendar days, negative is before the move",
        examples=[-1],
    )
    highlight: str | None = Field(
        default=None,
        description="the sentence the provider marked the company in, as plain text",
        examples=["MTN shares fell after the group cut its outlook"],
    )
    ingest_mode: str | None = Field(
        default=None,
        description="on_demand, nightly or backfill. null for articles stored before this was "
                    "recorded",
        examples=["backfill"],
    )
    collected_at: str | None = Field(
        default=None, description="when this app first stored the article, UTC",
        examples=["2026-09-24T06:00:00Z"],
    )


class PossibleExplanation(BaseModel):
    article_id: str = Field(examples=["abc-123"])
    title: str = Field(examples=["Naspers reports first-half results"])
    url: str | None = Field(default=None)
    source_name: str | None = Field(default=None, examples=["Moneyweb"])
    published_at: str = Field(examples=["2026-08-13T06:00:00+00:00"])
    scores: ExplanationScores
    relevance: str = Field(
        description="close when the headline names the company within a day of the move, "
                    "otherwise related",
        examples=["close"],
    )
    evidence: ExplanationEvidence


class EventDecomposition(BaseModel):
    stock_return_pct: float = Field(examples=[-10.8])
    market_return_pct: float = Field(examples=[-0.4])
    beta: float = Field(examples=[0.48])
    market_component_pct: float = Field(
        description="beta times the market's return, rounded before the subtraction below",
        examples=[-0.19],
    )
    company_component_pct: float = Field(
        description="stock_return_pct - market_component_pct, so the two parts always add up to "
                    "the move exactly",
        examples=[-10.61],
    )


class AfterEvent(BaseModel):
    days: int = Field(description="trading days after the event the last row is", examples=[10])
    car_pct: float = Field(
        description="the cumulative abnormal return on that row. it runs from t-5, so the event "
                    "day itself is in it",
        examples=[-11.2],
    )
    lower_pct: float = Field(examples=[-14.9])
    upper_pct: float = Field(examples=[-7.5])
    significant: bool = Field(examples=[True])


class PortfolioImpact(BaseModel):
    held_on_date: bool = Field(examples=[True])
    weight_pct: float | None = Field(
        default=None, description="the holding's weight at the close before the event",
        examples=[25.0],
    )
    contribution_pct: float | None = Field(
        default=None, description="weight_pct * the day's move / 100", examples=[-2.5],
    )
    basis: str = Field(
        description="holdings_on_date, or current_weight when there was no snapshot or close "
                    "to value the day before with, or not_held",
        examples=["holdings_on_date"],
    )


class SameDayBreadth(BaseModel):
    scanned: int = Field(
        description="other tickers the latest nightly scan scored on this date",
        examples=[48],
    )
    unusual: int = Field(
        description="how many of those the detector flagged that day, bad data left out",
        examples=[6],
    )
    same_direction: int = Field(description="of those, the ones that went the same way",
                                examples=[6])
    tickers: list[str] = Field(
        description="up to five of the same-direction moves, largest |z| first",
        examples=[["SBK.JO", "FSR.JO", "NED.JO"]],
    )
    expected_by_chance: float = Field(
        description="scanned * erfc(k / sqrt 2): the count if moves were independent and normal",
        examples=[0.13],
    )


class EventDetailResponse(BaseModel):
    available: bool = Field(examples=[True])
    reason: str | None = Field(
        default=None,
        description="why the model could not be fitted: insufficient_history, not_held, "
                    "no_price_history, no_benchmark_for_region, benchmark_did_not_move, "
                    "event_date_not_in_history, benchmark_is_self. benchmark_is_self means the "
                    "holding is the region's benchmark, so regressing it would be regressing a "
                    "series on itself - beta exactly 1 and a zero-width band",
        examples=[None],
    )
    ticker: str = Field(examples=["NPN.JO"])
    name: str | None = Field(default=None, examples=["Naspers"])
    date: str | None = Field(default=None, examples=["2026-08-14"])
    benchmark_label: str | None = Field(default=None, examples=["Satrix 40 (JSE Top 40 proxy)"])
    region: str | None = Field(
        default=None,
        description="only set on no_benchmark_for_region. it was being returned before this "
                    "field existed and dropped on serialisation, so the refusal said less than "
                    "the service knew",
        examples=["unknown"],
    )
    move_type: str | None = Field(
        default=None,
        description="market, company, mixed, against_market or unknown. against_market is the "
                    "stock and the market going opposite ways; otherwise it is the company "
                    "part's share of the move. always market when the holding is its own "
                    "benchmark, by construction",
        examples=["company"],
    )
    tracks_benchmark: bool = Field(
        default=False,
        description="the fit is near-perfect because this holding exists to track the index it "
                    "is measured against. the study is still valid; almost all of its abnormal "
                    "return is tracking error and currency rather than company news",
        examples=[False],
    )
    observations: int = Field(
        default=0,
        description="days in the estimation window. zero when the model was never fitted, so "
                    "a refusal has the same shape as a result",
        examples=[100],
    )
    alpha: float | None = Field(
        default=None,
        description="the fitted intercept. reported, never subtracted from the abnormal return",
        examples=[0.000214],
    )
    alpha_se: float | None = Field(default=None, examples=[0.000303])
    alpha_t: float | None = Field(
        default=None,
        description="alpha / alpha_se. null when the fit is exact and the standard error is 0",
        examples=[0.71],
    )
    beta: float | None = Field(default=None, examples=[1.1832])
    r_squared: float | None = Field(
        default=None,
        description="how much of this holding's day-to-day movement the benchmark explains. a "
                    "low value means the abnormal returns below are mostly just this holding "
                    "being unlike the index",
        examples=[0.4127],
    )
    residual_sigma: float | None = Field(
        default=None, description="the regression's s, over L - 2", examples=[0.0142],
    )
    sigma_ar: float | None = Field(
        default=None,
        description="the spread of the estimation window's abnormal returns, over L - 1. the "
                    "confidence band is built from this",
        examples=[0.003015],
    )
    estimation_window: EstimationWindow | None = None
    event_window: EventWindow | None = None
    abnormal_returns: list[AbnormalReturn] = []
    decomposition: EventDecomposition | None = None
    decomposition_reason: str | None = Field(
        default=None,
        description="benchmark_missing_day when the aligned return disagrees with the headline "
                    "move by more than 0.05 points, so no split is shown",
        examples=[None],
    )
    after_event: AfterEvent | None = Field(
        default=None, description="null until 5 trading days after the event exist",
    )
    portfolio_impact: PortfolioImpact | None = None
    possible_explanations: list[PossibleExplanation] = []
    same_day: SameDayBreadth | None = Field(
        default=None,
        description="null until a scan has recorded its coverage, or when it covered fewer "
                    "than 10 other tickers on this date",
    )
    note: str | None = Field(default=None)


class HoldingSeriesPoint(BaseModel):
    date: str = Field(examples=["2026-08-14"])
    close: float = Field(
        description="closing price in the units the cache stores, cents for JSE tickers. the "
                    "chart rebases to an index, so the unit never reaches a reader",
        examples=[335000.0],
    )


class HoldingSeries(BaseModel):
    ticker: str = Field(examples=["NPN.JO"])
    name: str | None = Field(default=None, examples=["Naspers"])
    points: list[HoldingSeriesPoint] = Field(
        description="empty when nothing is cached for this ticker, so the caller can say which "
                    "line it could not draw instead of silently dropping it"
    )


class HoldingSeriesResponse(BaseModel):
    period: str = Field(examples=["1y"])
    series: list[HoldingSeries]
    not_held: list[str] = Field(
        default=[],
        description="requested tickers that are not in this portfolio, ignored rather than served",
        examples=[["AAPL"]],
    )
