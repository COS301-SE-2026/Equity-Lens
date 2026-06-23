from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.holding import HoldingCreate, HoldingUpdate, HoldingResponse
from app.repositories.holding_repository import HoldingRepository

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

def _holding_to_dict(h) -> dict:
    current_price = h.avg_price  #Fallback until Ant implements yFinance / Alpha Vantage
    value = h.quantity * current_price
    gain = value - (h.quantity * h.avg_price)
    gain_pct = (gain / (h.quantity * h.avg_price) * 100) if h.avg_price else 0.0

    return {
        "id": str(h.id),
        "ticker": h.ticker,
        "name": h.name,
        "sector": h.sector,
        "quantity": h.quantity,
        "avg_price": h.avg_price,
        "current_price": current_price,
        "value": value,
        "gain_loss": gain,
        "gain_loss_pct": round(gain_pct, 2),
        "daily_change_pct": 0.0, #No hsitory to base this off, set to 0.0 till live market data
    }

def _build_summary(holdings: list[dict]) -> dict:
    total_value = sum(h["value"] for h in holdings)
    total_cost = sum(h["quantity"] * h["avg_price"] for h in holdings)
    total_gain = total_value - total_cost
    total_gain_pct = (total_gain / total_cost * 100) if total_cost else 0.0

    return {
        "totalValue": round(total_value, 2),
        "totalCost": round(total_cost, 2),
        "totalGain": round(total_gain, 2),
        "totalGainPercent": round(total_gain_pct, 2),
        "holdingsCount": len(holdings),
    }

def _build_sector_allocation(holdings: list[dict]) -> list[dict]:
    sector_values: dict[str, float] = {}
    total_value = sum(h["value"] for h in holdings)

    for h in holdings:
        sector = h["sector"] or "Other"
        sector_values[sector] = sector_values.get(sector, 0.0) + h["value"]

    return [
        {
            "sector": sector,
            "value": round(val, 2),
            "percentage": round((val / total_value * 100) if total_value else 0.0, 2),
        }
        for sector, val in sorted(sector_values.items(), key=lambda x: x[1], reverse=True)
    ]

@router.get("")
def get_portfolio(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = HoldingRepository(db).get_holdings_by_user(current_user.id)
    holdings_data = [_holding_to_dict(h) for h in holdings]

    return {
        "summary": _build_summary(holdings_data),
        "holdings": holdings_data,
        "sectorAllocation": _build_sector_allocation(holdings_data),
    }

@router.get("/summary")
def get_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = HoldingRepository(db).get_holdings_by_user(current_user.id)
    return _build_summary([_holding_to_dict(h) for h in holdings])

@router.get("/sectors")
def get_sectors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = HoldingRepository(db).get_holdings_by_user(current_user.id)
    return _build_sector_allocation([_holding_to_dict(h) for h in holdings])

@router.post("/holdings", response_model=HoldingResponse, status_code=201)
def create_holding(payload: HoldingCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return HoldingRepository(db).create_holding(user_id=current_user.id, **payload.model_dump())

@router.put("/holdings/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: UUID, payload: HoldingUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = HoldingRepository(db)
    holding = repo.get_holding_by_id(holding_id, current_user.id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    return repo.update_holding(holding, **payload.model_dump(exclude_unset=True))

@router.delete("/holdings/{holding_id}", status_code=204)
def delete_holding(holding_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = HoldingRepository(db)
    holding = repo.get_holding_by_id(holding_id, current_user.id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    repo.delete_holding(holding)