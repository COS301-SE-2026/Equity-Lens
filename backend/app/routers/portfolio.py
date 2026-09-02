import logging
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.health_config import HealthConfigRequest
from app.schemas.portfolio import (
    AccountTypeResponse,
    AccountTypeUpdate,
    CgtEstimateResponse,
    ConcentrationResponse,
    HealthConfigResponse,
    HealthScoreResponse,
    PerformancePoint,
    PortfolioRow,
    PortfolioSummary,
    ReturnsResponse,
    SectorInvestmentRequest,
    SectorSlice,
)
from app.schemas.responses import UNAUTHORISED, documented, two_states
from app.services.health_config_service import (
    clear_health_config,
    health_config_payload,
    save_health_config,
)
from app.services.portfolio_service import PortfolioService
from app.repositories.portfolio_repository import PortfolioRepository

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
    "summary": {"total_value": 9420.0, "total_cost": 9000.0, "total_gain_loss": 420.0,
                "total_gain_loss_pct": 4.67, "num_holdings": 1,
                "daily_change_pct": 0.31, "daily_change_value": 29.1},
    "holdings": [{"ticker": "SYG500.JO", "txn_key": "SYG500.JO", "name": "Satrix S&P 500",
                  "sector": "Global Equity", "kind": "etf", "region": "us",
                  "priced_live": True, "price_source": "live", "quantity": 100.0,
                  "avg_cost": 90.0, "total_cost": 9000.0, "current_price": 94.2,
                  "value": 9420.0, "gain_loss": 420.0, "gain_loss_pct": 4.67,
                  "daily_change_pct": 0.31, "first_purchase_date": "2026-08-06"}],
    "sectorAllocation": [{"sector": "Global Equity", "value": 9420.0, "percentage": 100.0}],
    "performanceHistory": [{"date": "2026-08-05", "name": "Aug 05", "value": 9020.0,
                            "benchmark": 9020.0, "twr_index": 100.0}],
    "benchmarkLabel": "JSE Top 40",
    "returns": {"portfolio_value": 9420.0, "invested_capital": 9000.0,
                "net_contributions": 10000.0, "unrealised_gain": 420.0,
                "realised_gain": 0.0, "total_costs": 0.0, "simple_return_pct": 4.67,
                "money_weighted_return_pct": 12.4, "time_weighted_return_pct": None,
                "snapshot_count": 22, "history_days": 30, "holdings_count": 1,
                "priced_live_count": 1, "priced_count": 1},
    "health": {"score": 0.3, "label": "Needs attention",
               "subscores": [{"key": "breadth", "label": "Breadth", "weight": 0.3,
                              "value": 0.1, "detail": "1 position",
                              "target": "8+ positions",
                              "improvement": "Add more positions"}]},
    "contributionsSeries": [{"date": "2026-08-05", "name": "Aug 05",
                             "portfolio_value": 9020.0,
                             "cumulative_net_contributions": 10000.0,
                             "cumulative_market_gain": -980.0}],
    "accountType": "tfsa",
    "statementDate": "2026-09-02",
    "cgt": {"available": False, "reason": "TFSA growth is not taxed",
            "assumptions": {"tax_year": "2026/27", "annual_exclusion": 40000.0,
                            "inclusion_rate": 0.4, "cost_basis_method": "average"},
            "net_unrealised_gain": None, "taxable_capital_gain": None,
            "assessed_capital_loss": None, "holdings_from_statement_only": []},
}

UNAVAILABLE_EXAMPLE = {"available": False, "reason": "No holdings imported yet"}

@router.get(
    "",
    responses=documented("The whole dashboard in one call", DASHBOARD_EXAMPLE),
)
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return drop_non_finite(PortfolioService(db).get_dashboard(current_user.id))


@router.get("/summary", response_model=PortfolioSummary, responses=UNAUTHORISED)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_summary(current_user.id)


@router.get("/sectors", response_model=list[SectorSlice], responses=UNAUTHORISED)
def get_sectors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_sector_allocation(current_user.id)


@router.get("/performance", response_model=list[PerformancePoint], responses=UNAUTHORISED)
def get_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_performance_history(current_user.id)


@router.get("/current", response_model=list[PortfolioRow], responses=UNAUTHORISED)
def get_current_information(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolios = PortfolioRepository(db).get_current_portfolios(
        current_user.id
    )

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

@router.get("/returns", response_model=ReturnsResponse, responses=UNAUTHORISED)
def get_returns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_returns(current_user.id)

@router.get("/health-score", response_model=HealthScoreResponse, responses=UNAUTHORISED)
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_health(current_user.id)

@router.get("/health-config", response_model=HealthConfigResponse, responses=UNAUTHORISED)
def get_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return health_config_payload(db, current_user.id)


@router.put("/health-config", response_model=HealthConfigResponse, responses=UNAUTHORISED)
def put_health_config(
    body: HealthConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return save_health_config(db, current_user.id, preset_key=body.preset_key, config=body.config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/health-config", response_model=HealthConfigResponse, responses=UNAUTHORISED)
def delete_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return clear_health_config(db, current_user.id)


@router.get("/cgt-estimate", response_model=CgtEstimateResponse, responses=UNAUTHORISED)
def get_cgt_estimate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_cgt_estimate(current_user.id)


@router.get("/account-type", response_model=AccountTypeResponse, responses=UNAUTHORISED)
def get_account_type(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_account_type(current_user.id)


@router.patch("/account-type", response_model=AccountTypeResponse, responses=UNAUTHORISED)
def set_account_type(
    body: AccountTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).set_account_type(current_user.id, body.account_type)


@router.get(
    "/tax-analysis",
    responses=two_states(
        "Unrealised position-level tax detail",
        {"available": True, "reason": None,
         "assumptions": {"tax_year": "2026/27", "annual_exclusion": 40000.0,
                         "inclusion_rate": 0.4, "cost_basis_method": "average"},
         "net_unrealised_gain": 420.0, "taxable_capital_gain": 0.0,
         "assessed_capital_loss": None, "holdings_from_statement_only": [],
         "holdings": [{"ticker": "SYG500.JO", "name": "Satrix S&P 500",
                       "unrealised_gain_loss": 420.0, "unrealised_gain_loss_pct": 4.67}],
         "potential_realised_loss": 0.0, "note": "Estimate only"},
        UNAVAILABLE_EXAMPLE),
)
def get_tax_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tax_analysis(current_user.id)


@router.get(
    "/tfsa-room",
    responses=two_states(
        "Annual and lifetime TFSA contribution room",
        {"available": True, "tax_year_label": "2026/27", "annual_limit": 36000.0,
         "annual_contributed": 10000.0, "annual_remaining": 26000.0,
         "lifetime_limit": 500000.0, "lifetime_contributed": 10000.0,
         "lifetime_remaining": 490000.0, "note": "Counted from imported statements only"},
        {"available": False, "reason": "This portfolio is not a TFSA"}),
)
def get_tfsa_room(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tfsa_room(current_user.id)


@router.get(
    "/market-context",
    responses=two_states(
        "How each sector you hold moved today",
        {"available": True, "label": "Today",
         "sectors": [{"sector": "Global Equity", "weight_pct": 100.0,
                      "daily_change_pct": 0.31, "tickers": ["SYG500.JO"],
                      "summary": "Global Equity is up today"}]},
        {"available": False, "sectors": []}),
)
def get_market_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_market_context(current_user.id)


@router.get("/concentration", response_model=ConcentrationResponse, responses=UNAUTHORISED)
def get_concentration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_concentration_analysis(current_user.id)


@router.post(
    "/simulate-sector-investment",
    responses=two_states(
        "What adding to one sector would do to the health score",
        {"available": True, "sector": "Financials", "illustrative_amount": 5000.0,
         "current_weight_pct": 0.0, "projected_weight_pct": 34.7,
         "health_score_before": 0.3, "health_score_after": 0.45,
         "is_smallest_sector": True, "explanation": "Adding here spreads the book",
         "disclaimer": "Illustrative only, not advice"},
        UNAVAILABLE_EXAMPLE),
)
def simulate_sector_investment(
    body: SectorInvestmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_investment(current_user.id, body.sector)


@router.post(
    "/simulate-sector-rebalance",
    responses=two_states(
        "What an even sector split would do to the health score",
        {"available": True, "health_score_before": 0.3, "health_score_after": 0.62,
         "moves": [], "disclaimer": "Illustrative only, not advice"},
        {"available": False, "reason": "Needs at least two sectors"}),
)
def simulate_sector_rebalance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_rebalance(current_user.id)
