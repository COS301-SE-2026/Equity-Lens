from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.pdf_summary_service import get_summary_import_PDF
from app.services.pdf_summary_service import get_the_top_holdings_import_PDF
from app.services.pdf_summary_service import get_the_top_allocation_import_PDF


router = APIRouter(prefix="/api/import_pdf_summary", tags=["Import PDF"])

@router.get("/summary/{portfolioID}")
def import_get_summary_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_summary_import_PDF(
        database=db,
        portfolioID=portfolioID
    )

@router.get("/top_holdings/{portfolioID}")
def import_get_the_top_holdings_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_the_top_holdings_import_PDF(
        database=db,
        portfolioID=portfolioID
    )

@router.get("/portfolio_allocation/{portfolioID}")
def import_get_the_top_allocation_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_the_top_allocation_import_PDF(
        database=db,
        portfolioID=portfolioID
    )