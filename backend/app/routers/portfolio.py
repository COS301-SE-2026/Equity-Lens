import logging
import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.portfolio_repository import PortfolioRepository
from app.schemas.health_config import HealthConfigRequest
from app.schemas.portfolio import (
    AccountTypeResponse,
    AccountTypeUpdate,
    CgtEstimateResponse,
    ConcentrationResponse,
    EventDetailResponse,
    HealthConfigResponse,
    HealthScoreResponse,
    HoldingSeriesResponse,
    MarketContextResponse,
    PerformancePoint,
    PortfolioEventsResponse,
    PortfolioRow,
    PortfolioSummary,
    ReturnsResponse,
    SectorInvestmentRequest,
    SectorInvestmentResponse,
    SectorRebalanceResponse,
    SectorSlice,
    TaxAnalysisResponse,
    TfsaRoomResponse,
)
from app.schemas.responses import UNAUTHORISED, documented, two_states
from app.services.health_config_service import (
    clear_health_config,
    health_config_payload,
    save_health_config,
)
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])

logger = logging.getLogger(__name__)


def drop_non_finite(node, path: str = "dashboard"):
    if isinstance(node, dict):
        return {key: drop_non_finite(value, f"{path}.{key}") for key, value in node.items()}
    if isinstance(node, list):
        return [drop_non_finite(item, f"{path}[{i}]") for i, item in enumerate(node)]
    if isinstance(node, float) and not math.isfinite(node):
        logger.error("dropping non-finite value %r at %s", node, path)
        return None
    return node


DASHBOARD_EXAMPLE = {
    "summary": {
        "total_value": 9420.0,
        "total_cost": 9000.0,
        "total_gain_loss": 420.0,
        "total_gain_loss_pct": 4.67,
        "num_holdings": 1,
        "daily_change_pct": 0.31,
        "daily_change_value": 29.1,
    },
    "holdings": [
        {
            "ticker": "SYG500.JO",
            "txn_key": "SYG500.JO",
            "name": "Satrix S&P 500",
            "sector": "Global Equity",
            "kind": "etf",
            "region": "us",
            "priced_live": True,
            "price_source": "live",
            "quantity": 100.0,
            "avg_cost": 90.0,
            "total_cost": 9000.0,
            "current_price": 94.2,
            "value": 9420.0,
            "gain_loss": 420.0,
            "gain_loss_pct": 4.67,
            "daily_change_pct": 0.31,
            "first_purchase_date": "2026-08-06",
            "quote_currency": "ZAR",
            "fx_rate": None,
            "daily_change_is_local": False,
        }
    ],
    "sectorAllocation": [{"sector": "Global Equity", "value": 9420.0, "percentage": 100.0}],
    "thresholds": {"concentration_low": 25, "concentration_high": 45},
    "performanceHistory": [
        {
            "date": "2026-08-05",
            "name": "Aug 05",
            "value": 9020.0,
            "benchmark": 9020.0,
            "twr_index": 100.0,
        }
    ],
    "historyQuality": {
        "first_day": "2026-02-04",
        "priced_value_pct": 94.2,
        "unpriced_tickers": ["XYZ.JO"],
        "ledger_conflicts": 0,
        "suspect_dates": [],
    },
    "benchmarkLabel": "Satrix 40 (JSE Top 40 proxy) 72% + S&P 500 (SPY ETF proxy) 28%",
    "benchmarkComposition": [
        {"region": "za", "label": "Satrix 40 (JSE Top 40 proxy)", "weight": 72.4},
        {"region": "us", "label": "S&P 500 (SPY ETF proxy)", "weight": 27.6},
    ],
    "returns": {
        "portfolio_value": 9420.0,
        "invested_capital": 9000.0,
        "net_contributions": 10000.0,
        "unrealised_gain": 420.0,
        "realised_gain": 0.0,
        "total_costs": 0.0,
        "simple_return_pct": 4.67,
        "money_weighted_return_pct": 12.4,
        "time_weighted_return_pct": None,
        "snapshot_count": 22,
        "history_days": 30,
        "holdings_count": 1,
        "priced_live_count": 1,
        "priced_count": 1,
    },
    "health": {
        "score": 0.3,
        "label": "Needs attention",
        "subscores": [
            {
                "key": "breadth",
                "label": "Breadth",
                "weight": 0.3,
                "value": 0.1,
                "detail": "1 position",
                "target": "8+ positions",
                "improvement": "Add more positions",
            }
        ],
    },
    "contributionsSeries": [
        {
            "date": "2026-08-05",
            "name": "Aug 05",
            "portfolio_value": 9020.0,
            "cumulative_net_contributions": 10000.0,
            "cumulative_market_gain": -980.0,
        }
    ],
    "accountType": "tfsa",
    "statementDate": "2026-09-02",
    "importedAt": "2026-07-31",
    "historyStartsAt": "2026-02-04",
    "cgt": {
        "available": False,
        "reason": "TFSA growth is not taxed",
        "assumptions": {
            "tax_year": "2026/27",
            "annual_exclusion": 40000.0,
            "inclusion_rate": 0.4,
            "cost_basis_method": "average",
        },
        "net_unrealised_gain": None,
        "taxable_capital_gain": None,
        "assessed_capital_loss": None,
        "holdings_from_statement_only": [],
    },
}

UNAVAILABLE_EXAMPLE = {"available": False, "reason": "No holdings imported yet"}


@router.get(
    "",
    summary="Get the whole dashboard",
    operation_id="getDashboard",
    responses=documented("The whole dashboard in one call", DASHBOARD_EXAMPLE),
)
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return drop_non_finite(PortfolioService(db).get_dashboard(current_user.id))


@router.get(
    "/summary",
    summary="Get the headline totals",
    operation_id="getPortfolioSummary",
    response_model=PortfolioSummary,
    responses=UNAUTHORISED,
)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_summary(current_user.id)


@router.get(
    "/sectors",
    summary="Get the sector allocation",
    operation_id="getSectorAllocation",
    response_model=list[SectorSlice],
    responses=UNAUTHORISED,
)
def get_sectors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_sector_allocation(current_user.id)


@router.get(
    "/performance",
    summary="Get the value history against its benchmark",
    operation_id="getPerformanceHistory",
    response_model=list[PerformancePoint],
    responses=UNAUTHORISED,
)
def get_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_performance_history(current_user.id)


@router.get(
    "/current",
    summary="List the imported portfolios",
    operation_id="listPortfolios",
    response_model=list[PortfolioRow],
    responses=UNAUTHORISED,
)
def get_current_information(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolios = PortfolioRepository(db).get_current_portfolios(current_user.id)

    return [
        {
            "id": portfolio.id,
            "document_id": portfolio.document_id,
            "portfolio_name": portfolio.portfolio_name,
            "account_number": portfolio.account_number,
            "statement_end_date": portfolio.statement_end_date,
            "statement_start_date": portfolio.statement_start_date,
            "account_type": portfolio.account_type,
        }
        for portfolio in portfolios
    ]


@router.get(
    "/returns",
    summary="Get the three return measures",
    operation_id="getReturns",
    response_model=ReturnsResponse,
    responses=UNAUTHORISED,
)
def get_returns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_returns(current_user.id)


@router.get(
    "/health-score",
    summary="Get the portfolio health score",
    operation_id="getHealthScore",
    response_model=HealthScoreResponse,
    responses=UNAUTHORISED,
)
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_health(current_user.id)


@router.get(
    "/health-config",
    summary="Get the active health scoring config",
    operation_id="getHealthConfig",
    response_model=HealthConfigResponse,
    responses=UNAUTHORISED,
)
def get_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return health_config_payload(db, current_user.id)


@router.put(
    "/health-config",
    summary="Choose or hand-tune the health scoring config",
    operation_id="updateHealthConfig",
    response_model=HealthConfigResponse,
    responses={**UNAUTHORISED, 400: {"description": "Values outside the published bounds"}},
)
def put_health_config(
    body: HealthConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change what the health score treats as risky. Send exactly one of the two fields.

    preset_key picks one of the presets listed by GET /health-config. config sets the
    seven values by hand, and every one of them must be inside bounds from that same
    response - anything outside is a 400, not a clamp. The three weights must also sum
    to 1.

    Hand-tuned values that happen to match a preset are stored as that preset, so the
    response can come back with source preset and a preset_key you did not send. The
    response is always the full config payload, so there is no need to re-fetch.
    """
    try:
        return save_health_config(
            db, current_user.id, preset_key=body.preset_key, config=body.config
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/health-config",
    summary="Reset the health scoring config",
    operation_id="resetHealthConfig",
    response_model=HealthConfigResponse,
    responses=UNAUTHORISED,
)
def delete_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return clear_health_config(db, current_user.id)


@router.get(
    "/cgt-estimate",
    summary="Estimate capital gains tax if everything were sold",
    operation_id="getCgtEstimate",
    response_model=CgtEstimateResponse,
    responses=UNAUTHORISED,
)
def get_cgt_estimate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_cgt_estimate(current_user.id)


@router.get(
    "/account-type",
    summary="Get the account type",
    operation_id="getAccountType",
    response_model=AccountTypeResponse,
    responses=UNAUTHORISED,
)
def get_account_type(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_account_type(current_user.id)


@router.patch(
    "/account-type",
    summary="Set the account type",
    operation_id="setAccountType",
    response_model=AccountTypeResponse,
    responses=UNAUTHORISED,
)
def set_account_type(
    body: AccountTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).set_account_type(current_user.id, body.account_type)


@router.get(
    "/tax-analysis",
    summary="Get position-level unrealised tax detail",
    operation_id="getTaxAnalysis",
    response_model=TaxAnalysisResponse,
    responses=two_states(
        "Unrealised position-level tax detail",
        {
            "available": True,
            "reason": None,
            "assumptions": {
                "tax_year": "2026/27",
                "annual_exclusion": 40000.0,
                "inclusion_rate": 0.4,
                "cost_basis_method": "average",
            },
            "net_unrealised_gain": 420.0,
            "taxable_capital_gain": 0.0,
            "assessed_capital_loss": None,
            "holdings_from_statement_only": [],
            "holdings": [
                {
                    "ticker": "SYG500.JO",
                    "name": "Satrix S&P 500",
                    "unrealised_gain_loss": 420.0,
                    "unrealised_gain_loss_pct": 4.67,
                }
            ],
            "potential_realised_loss": 0.0,
            "note": "Estimate only",
        },
        UNAVAILABLE_EXAMPLE,
    ),
)
def get_tax_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tax_analysis(current_user.id)


@router.get(
    "/tfsa-room",
    summary="Get remaining TFSA contribution room",
    operation_id="getTfsaRoom",
    response_model=TfsaRoomResponse,
    responses=two_states(
        "Annual and lifetime TFSA contribution room",
        {
            "available": True,
            "tax_year_label": "2026/27",
            "annual_limit": 46000.0,
            "annual_contributed": 10000.0,
            "annual_remaining": 36000.0,
            "lifetime_limit": 500000.0,
            "lifetime_contributed": 10000.0,
            "lifetime_remaining": 490000.0,
            "note": "Counted from imported statements only",
        },
        {"available": False, "reason": "This portfolio is not a TFSA"},
    ),
)
def get_tfsa_room(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tfsa_room(current_user.id)


@router.get(
    "/market-context",
    summary="Get today's move by sector held",
    operation_id="getMarketContext",
    response_model=MarketContextResponse,
    responses=two_states(
        "How each sector you hold moved today",
        {
            "available": True,
            "label": "Illustrative market context",
            "sectors": [
                {
                    "sector": "Global Equity",
                    "weight_pct": 100.0,
                    "priced_weight_pct": 100.0,
                    "daily_change_pct": 0.31,
                    "tickers": ["SYG500.JO"],
                    "summary": "Your Global Equity holdings (SYG500.JO) are up 0.3% today.",
                }
            ],
        },
        {"available": False, "sectors": []},
    ),
)
def get_market_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_market_context(current_user.id)


@router.get(
    "/concentration",
    summary="Flag holdings that are too large a share of the book",
    operation_id="getConcentration",
    response_model=ConcentrationResponse,
    responses=UNAUTHORISED,
)
def get_concentration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_concentration_analysis(current_user.id)


@router.post(
    "/simulate-sector-investment",
    summary="Simulate adding to one sector",
    operation_id="simulateSectorInvestment",
    response_model=SectorInvestmentResponse,
    responses=two_states(
        "What adding to one sector would do to the health score",
        {
            "available": True,
            "sector": "Technology",
            "illustrative_amount": 8374.8,
            "current_weight_pct": 62.0,
            "projected_weight_pct": 63.8,
            "health_score_before": 4.8,
            "health_score_after": 4.6,
            "subscore_deltas": [
                {
                    "key": "sectorConcentration",
                    "label": "Sector Concentration",
                    "before": 6.8,
                    "after": 6.5,
                    "weight": 0.4,
                }
            ],
            "is_smallest_sector": False,
            "explanation": "Technology is already 62.0% of your book, past the 45% your yardstick "
            "flags as concentrated.",
            "thresholds": {"concentration_low": 25.0, "concentration_high": 45.0},
            "disclaimer": "Illustrative only, not advice",
        },
        UNAVAILABLE_EXAMPLE,
    ),
)
def simulate_sector_investment(
    body: SectorInvestmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_investment(current_user.id, body.sector)


@router.post(
    "/simulate-sector-rebalance",
    summary="Simulate an even sector split",
    operation_id="simulateSectorRebalance",
    response_model=SectorRebalanceResponse,
    responses=two_states(
        "What an even sector split would do to the health score",
        {
            "available": True,
            "from_sector": "Technology",
            "to_sector": "Healthcare",
            "value_shifted": 12500.0,
            "from_sector_before_pct": 58.0,
            "to_sector_before_pct": 6.0,
            "health_score_before": 4.5,
            "health_score_after": 6.8,
            "subscore_deltas": [
                {
                    "key": "sectorConcentration",
                    "label": "Sector Concentration",
                    "before": 4.1,
                    "after": 7.4,
                    "weight": 0.4,
                }
            ],
            "explanation": "Technology is your most concentrated sector",
            "thresholds": {"concentration_low": 25.0, "concentration_high": 45.0},
            "disclaimer": "Illustrative only, not advice",
        },
        {
            "available": False,
            "reason": "no_sector_overconcentrated",
            "thresholds": {"concentration_low": 25.0, "concentration_high": 45.0},
        },
    ),
)
def simulate_sector_rebalance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_rebalance(current_user.id)


EVENT_PERIODS = {"6mo", "1y", "2y", "5y"}
MIN_K_SIGMA = 2.0
MAX_K_SIGMA = 6.0


@router.get(
    "/events",
    summary="Find days a holding moved further than its own volatility explains",
    operation_id="getPortfolioEvents",
    response_model=PortfolioEventsResponse,
    responses={**UNAUTHORISED, 400: {"description": "Unknown period, or k outside 2-6"}},
)
def get_portfolio_events(
    period: str = "1y",
    k: float = 3.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if period not in EVENT_PERIODS:
        raise HTTPException(
            status_code=400, detail=f"period must be one of {sorted(EVENT_PERIODS)}"
        )
    if not MIN_K_SIGMA <= k <= MAX_K_SIGMA:
        raise HTTPException(
            status_code=400, detail=f"k must be between {MIN_K_SIGMA} and {MAX_K_SIGMA}"
        )

    k = round(k * 2) / 2
    return drop_non_finite(
        PortfolioService(db).get_events(current_user.id, period=period, k_sigma=k), "events"
    )


@router.get(
    "/events/{ticker}/{event_date}",
    summary="Fit a market model to one event",
    operation_id="getEventDetail",
    response_model=EventDetailResponse,
    responses={**UNAUTHORISED, 404: {"description": "That ticker is not in the portfolio"}},
)
def get_event_detail(
    ticker: str,
    event_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    payload = PortfolioService(db).get_event_detail(current_user.id, ticker, event_date)
    if payload.get("reason") == "not_held":
        raise HTTPException(status_code=404, detail=f"{ticker} is not in this portfolio")
    return drop_non_finite(payload, "event")


@router.get(
    "/holdings/series",
    summary="Get price history for a few held tickers",
    operation_id="getHoldingSeries",
    response_model=HoldingSeriesResponse,
    responses={**UNAUTHORISED, 400: {"description": "No tickers given, or an unknown period"}},
)
def get_holding_series(
    tickers: str,
    period: str = "1y",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if period not in EVENT_PERIODS:
        raise HTTPException(
            status_code=400, detail=f"period must be one of {sorted(EVENT_PERIODS)}"
        )

    wanted = [t for t in tickers.split(",") if t.strip()]
    if not wanted:
        raise HTTPException(status_code=400, detail="tickers must not be empty")

    return drop_non_finite(
        PortfolioService(db).get_holding_series(current_user.id, wanted, period=period), "series"
    )
