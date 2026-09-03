from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.services.pdf_summary_service import get_summary_import_PDF
from app.services.pdf_summary_service import get_the_top_holdings_import_PDF
from app.services.pdf_summary_service import get_the_top_allocation_import_PDF
from app.services.pdf_summary_service import get_the_lowest_holdings_import_PDF
from app.services.pdf_summary_service import get_trading_activity_import_PDF
from app.services.pdf_summary_service import get_cash_flow_import_PDF
from app.services.pdf_summary_service import get_dividend_income_import_PDF
from app.services.pdf_summary_service import get_expenses_import_PDF
from pydantic import BaseModel, Field
from typing import Any


router = APIRouter(prefix="/api/import_pdf_summary", tags=["Import PDF"])

class SummaryResponse(BaseModel):
    PortfolioValue: float = Field(example=["APPLE"])
    TotalHoldings: int = Field(example=["22"])
    TotalPurchasesAndSales: float= Field(example=["23"])
    TotalTransactionCosts: float= Field(example=["23"])
    TotalContributionsAndWithdrawals: float = Field(example=[34.0])
    TotalDividendsAndWithholdingTax: float= Field(example=["45"])
    TotalTransactionInterest: float= Field(example=["56"])
    TotalTransactionExpenses: float= Field(example=["68"])

class HoldingResponse(BaseModel):
    name: str | None = Field(default = None, example=["APPLE"])
    value: float = Field(example=["68"])

class PortfolioResponse(BaseModel):
    name: str = Field(example=["APPLE"])
    weight_percentage: float = Field(example=["56"])

class DividendResponse(BaseModel):
    name: str = Field(example=["APPLE"])
    gross_dividend: float = Field(example=[2.3])
    withholding_tax: float = Field(example=[2.3])
    net_dividend: float = Field(example=[2.3])

@router.get("/summary/{portfolioID}", response_model=SummaryResponse)
def import_get_summary_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_summary_import_PDF(
        database=db,
        portfolioID=portfolioID,    
        user_id=CurrentUser.id

    )

@router.get("/top_holdings/{portfolioID}", response_model=list[HoldingResponse])
def import_get_the_top_holdings_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_the_top_holdings_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/lowest_holdings/{portfolioID}", response_model=HoldingResponse)
def import_get_the_lowest_holdings_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_the_lowest_holdings_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/portfolio_allocation/{portfolioID}", response_model=list[PortfolioResponse])
def import_get_the_top_allocation_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_the_top_allocation_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/trading_activity/{portfolioID}", response_model=list[HoldingResponse])
def import_get_trading_activity_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_trading_activity_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/cash_flow/{portfolioID}", response_model=list[HoldingResponse])
def import_get_cash_flow_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_cash_flow_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/dividend_income/{portfolioID}", response_model=list[DividendResponse])
def import_get_dividend_income_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_dividend_income_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )

@router.get("/expenses/{portfolioID}", response_model=list[HoldingResponse])
def import_get_expenses_import_PDF(portfolioID: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_expenses_import_PDF(
        database=db,
        portfolioID=portfolioID,
        user_id=CurrentUser.id
    )