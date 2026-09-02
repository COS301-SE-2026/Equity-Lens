import logging
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.health_config import HealthConfigRequest
from app.schemas.portfolio import AccountTypeUpdate, SectorInvestmentRequest
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


@router.get("")
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return drop_non_finite(PortfolioService(db).get_dashboard(current_user.id))


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_summary(current_user.id)


@router.get("/sectors")
def get_sectors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_sector_allocation(current_user.id)


@router.get("/performance")
def get_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_performance_history(current_user.id)


@router.get("/current")
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

@router.get("/returns")
def get_returns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_returns(current_user.id)

@router.get("/health-score")
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_health(current_user.id)

@router.get("/health-config")
def get_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return health_config_payload(db, current_user.id)


@router.put("/health-config")
def put_health_config(
    body: HealthConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return save_health_config(db, current_user.id, preset_key=body.preset_key, config=body.config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/health-config")
def delete_health_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return clear_health_config(db, current_user.id)


@router.get("/cgt-estimate")
def get_cgt_estimate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_cgt_estimate(current_user.id)


@router.get("/account-type")
def get_account_type(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_account_type(current_user.id)


@router.patch("/account-type")
def set_account_type(
    body: AccountTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).set_account_type(current_user.id, body.account_type)


@router.get("/tax-analysis")
def get_tax_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tax_analysis(current_user.id)


@router.get("/tfsa-room")
def get_tfsa_room(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_tfsa_room(current_user.id)


@router.get("/market-context")
def get_market_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_market_context(current_user.id)


@router.get("/concentration")
def get_concentration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).get_concentration_analysis(current_user.id)


@router.post("/simulate-sector-investment")
def simulate_sector_investment(
    body: SectorInvestmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_investment(current_user.id, body.sector)


@router.post("/simulate-sector-rebalance")
def simulate_sector_rebalance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PortfolioService(db).simulate_sector_rebalance(current_user.id)
