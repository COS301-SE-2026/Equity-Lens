from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.pdf_summary_service import GetSummaryImportPDF
from app.services.pdf_summary_service import GetTheTopHoldingsImportPDF
from app.services.pdf_summary_service import GetTheTopAllocationImportPDF


router = APIRouter(prefix="/import_pdf_summary", tags=["Import PDF"])

@router.get("/summary/{portfolioID}")
def ImportGetSummaryImportPDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return GetSummaryImportPDF(
        database=db,
        portfolioID=portfolioIDs
    )

@router.get("/top_holdings/{portfolioID}")
def ImportGetTheTopHoldingsImportPDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return GetTheTopHoldingsImportPDF(
        database=db,
        portfolioID=portfolioID
    )

@router.get("/portfolio_allocation/{portfolioID}")
def ImportGetTheTopAllocationImportPDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return GetTheTopAllocationImportPDF(
        database=db,
        portfolioID=portfolioID
    )