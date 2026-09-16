from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.import_pdf import (
    ContributionsAndWithdrawalsRequest,
    DividendsAndWithholdingTaxRequest,
    HoldingsRequest,
    ImportPdfRequest,
    InstrumentPurchasesAndSalesRequest,
    PortfolioRequest,
    TransactionExpensesRequest,
)
from app.services.import_pdf import (
    delete_portfolio_import,
    get_my_portfolio,
    import_Pdf_data,
    save_contributions_and_withdrawals_import,
    save_dividends_and_withholding_tax_import,
    save_holdings_import,
    save_instrument_purchases_and_sales_import,
    save_portfolios_import,
    save_transaction_expenses_import,
)


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
def import_Pdf_data_DB(
    data: ImportPdfRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return import_Pdf_data(database=db, user_id=CurrentUser.id, data=data)


@router.get("/my_portfolio", response_model=MyPortfolioResponse)
def get_my_portfolio_DB(
    db: Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)
):
    return get_my_portfolio(database=db, user_id=CurrentUser.id)


@router.post("/save_portfolios", response_model=SavePortfolioResponse)
def save_portfolios_import_DB(
    data: PortfolioRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_portfolios_import(database=db, user_id=CurrentUser.id, data=data)


@router.post("/save_holdings", response_model=SaveActionResponse)
def save_holdings_import_DB(
    data: HoldingsRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_holdings_import(database=db, user_id=CurrentUser.id, data=data)


@router.post("/save_instrument_purchases_and_sales", response_model=SaveActionResponse)
def save_instrument_purchases_and_sales_import_DB(
    data: InstrumentPurchasesAndSalesRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_instrument_purchases_and_sales_import(
        database=db, user_id=CurrentUser.id, data=data
    )


@router.post("/save_contributions_and_withdrawals", response_model=SaveActionResponse)
def save_contributions_and_withdrawals_import_DB(
    data: ContributionsAndWithdrawalsRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_contributions_and_withdrawals_import(database=db, user_id=CurrentUser.id, data=data)


@router.post("/save_dividends_and_withholding_tax", response_model=SaveActionResponse)
def save_dividends_and_withholding_tax_import_DB(
    data: DividendsAndWithholdingTaxRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_dividends_and_withholding_tax_import(database=db, user_id=CurrentUser.id, data=data)


@router.post("/save_transaction_expenses", response_model=SaveActionResponse)
def save_transaction_expenses_import_DB(
    data: TransactionExpensesRequest,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return save_transaction_expenses_import(database=db, user_id=CurrentUser.id, data=data)


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio_import_DB(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    CurrentUser: UserResponse = Depends(get_current_user),
):
    return delete_portfolio_import(database=db, user_id=CurrentUser.id, portfolio_id=portfolio_id)
