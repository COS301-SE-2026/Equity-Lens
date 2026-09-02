from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.import_pdf import ImportPdfRequest
from app.schemas.import_pdf import PortfolioRequest
from app.schemas.import_pdf import HoldingsRequest
from app.schemas.import_pdf import InstrumentPurchasesAndSalesRequest
from app.schemas.import_pdf import ContributionsAndWithdrawalsRequest
from app.schemas.import_pdf import DividendsAndWithholdingTaxRequest
from app.schemas.import_pdf import TransactionExpensesRequest
from app.services.import_pdf import import_Pdf_data
from app.services.import_pdf import save_portfolios_import
from app.services.import_pdf import get_my_portfolio
from app.services.import_pdf import save_holdings_import
from app.services.import_pdf import save_instrument_purchases_and_sales_import
from app.services.import_pdf import save_contributions_and_withdrawals_import
from app.services.import_pdf import save_dividends_and_withholding_tax_import
from app.services.import_pdf import save_transaction_expenses_import
from app.services.import_pdf import delete_portfolio_import
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from pydantic import BaseModel, Field
from typing import Any
from uuid import UUID

class ImportPDFResponse(BaseModel):
    Success: bool = Field(examples=[True])
    Message: str = Field(examples=["PDF has been saved successfully"])
    document_id: str = Field(examples=["123"])

class MyPortfolioResponse(BaseModel):
    Found: bool = Field(examples=[True])
    portfolio_id: str = Field(examples=["123"])

class SavePortfolioResponse(BaseModel):
    Success: bool = Field(examples=[True])
    Message: str = Field(examples=["PDF has been saved successfully"])
    portfolio_id: str = Field(examples=["123"])

class SaveActionResponse(BaseModel):
    Success: bool = Field(examples=[True])
    Message: str = Field(examples=["Saved successfully"])


router = APIRouter(prefix="/api/import_pdf", tags=["Import PDF"])

@router.post("/", response_model=ImportPDFResponse)
def import_Pdf_data_DB(data: ImportPdfRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return import_Pdf_data(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.get("/my_portfolio", response_model=MyPortfolioResponse)
def get_my_portfolio_DB(db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return get_my_portfolio(
        database=db,
        user_id=CurrentUser.id
    )

@router.post("/save_portfolios", response_model=SavePortfolioResponse)
def save_portfolios_import_DB(data: PortfolioRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_portfolios_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_holdings", response_model=SaveActionResponse)
def save_holdings_import_DB(data: HoldingsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_holdings_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_instrument_purchases_and_sales", response_model=SaveActionResponse)
def save_instrument_purchases_and_sales_import_DB(data: InstrumentPurchasesAndSalesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_instrument_purchases_and_sales_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_contributions_and_withdrawals", response_model=SaveActionResponse)
def save_contributions_and_withdrawals_import_DB(data: ContributionsAndWithdrawalsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_contributions_and_withdrawals_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_dividends_and_withholding_tax", response_model=SaveActionResponse)
def save_dividends_and_withholding_tax_import_DB(data: DividendsAndWithholdingTaxRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_dividends_and_withholding_tax_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_transaction_expenses", response_model=SaveActionResponse)
def save_transaction_expenses_import_DB(data: TransactionExpensesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_transaction_expenses_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio_import_DB(portfolio_id: UUID,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return delete_portfolio_import(
        database=db,
        user_id=CurrentUser.id,
        portfolio_id=portfolio_id
    )