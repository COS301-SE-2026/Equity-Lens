from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])

@router.get("")
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "summary": {
            "totalValue": 0.0,
            "totalCost": 0.0,
            "totalGain": 0.0,
            "totalGainPercent": 0.0,
            "holdingsCount": 0,
        },
        "holdings": [],
        "sectorAllocation": [],
    }


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "totalValue": 0.0,
        "totalCost": 0.0,
        "totalGain": 0.0,
        "totalGainPercent": 0.0,
        "holdingsCount": 0,
    }


@router.get("/sectors")
def get_sectors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return []