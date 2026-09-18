from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.pdf_summary_service import get_summary_import_PDF,get_the_top_holdings_import_PDF,get_the_top_allocation_import_PDF,get_the_lowest_holdings_import_PDF,get_trading_activity_import_PDF,get_cash_flow_import_PDF,get_dividend_income_import_PDF
from app.services.portfolio_snapshot_service import build_snapshot
from fastapi.responses import StreamingResponse
from app.services.portfolio_brief_service import generate_portfolio_brief

router = APIRouter(prefix="/api/portfolio_snapshot", tags=["Portfolio Snapshot"])

@router.get("/{portfolio_id}")
def get_portfolio_snapshot(portfolio_id: UUID,db: Session = Depends(get_db),current_user: UserResponse = Depends(get_current_user)):
    repository = PortfolioRepository(db)

    portfolio = repository.get_portfolio_for_user(
        portfolio_id=portfolio_id, 
        user_id=current_user.id,
    )

    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail="Portfolio Not Found"
        )

    summary = get_summary_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    top_holdings = get_the_top_holdings_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    allocation = get_the_top_allocation_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )


    lowest = get_the_lowest_holdings_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )


    trading = get_trading_activity_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    cash_flow = get_cash_flow_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    dividends = get_dividend_income_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    snapshot = build_snapshot(
        portfolio_id=str(portfolio_id),
        summary=summary,
        top_holdings=top_holdings,
        allocation=allocation,
        lowest_holding=lowest,
        trading_activity=trading,
        cash_flow=cash_flow,
        dividend_income=dividends,
    )

    stored_snapshot = repository.save_canonical_snapshot(
        portfolio_id=portfolio_id,
        snapshot_hash=snapshot["snapshot_id"],
        snapshot_data=snapshot["snapshot"],

    )

    return {
        "snapshot_id": snapshot["snapshot_id"],
        "snapshot": snapshot["snapshot"],
        "stored_snapshot_id": str(stored_snapshot.id),
        "created_at": stored_snapshot.created_at,
    }

@router.get("/{portfolio_id}/download")
def download_portfolio_snapshot(portfolio_id: UUID,db: Session = Depends(get_db),current_user: UserResponse = Depends(get_current_user)):
    repository = PortfolioRepository(db)
    portfolio = repository.get_portfolio_for_user(
        portfolio_id=portfolio_id, 
        user_id=current_user.id,
    )

    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail="Portfolio Not Found"
        )

    stored_snapshot = (
        repository.get_latest_canonical_snapshot(portfolio_id)
    )

    if stored_snapshot is None:
        raise HTTPException(
            status_code=404,
            detail="No snapshot found for this portfolio"
        )

    pdf = generate_portfolio_brief(
        portfolio_id=str(portfolio_id),
        snapshot_hash=stored_snapshot.snapshot_hash,
        snapshot=stored_snapshot.snapshot_data,
    )

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="Equity-lens-{current_user.full_name}.pdf"'
            )
        },
    )


