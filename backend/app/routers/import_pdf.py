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
from app.services.import_pdf import save_holdings_import
from app.services.import_pdf import save_instrument_purchases_and_sales_import
from app.services.import_pdf import save_contributions_and_withdrawals_import
from app.services.import_pdf import save_dividends_and_withholding_tax_import
from app.services.import_pdf import save_transaction_expenses_import
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse


router = APIRouter(prefix="/api/import_pdf", tags=["Import PDF"])

@router.post("/")
def import_Pdf_data_DB(data: ImportPdfRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return import_Pdf_data(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_portfolios")
def save_portfolios_import_DB(data: PortfolioRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_portfolios_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_holdings")
def save_holdings_import_DB(data: HoldingsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_holdings_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_instrument_purchases_and_sales")
def save_instrument_purchases_and_sales_import_DB(data: InstrumentPurchasesAndSalesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_instrument_purchases_and_sales_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_contributions_and_withdrawals")
def save_contributions_and_withdrawals_import_DB(data: ContributionsAndWithdrawalsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_contributions_and_withdrawals_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_dividends_and_withholding_tax")
def save_dividends_and_withholding_tax_import_DB(data: DividendsAndWithholdingTaxRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_dividends_and_withholding_tax_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_transaction_expenses")
def save_transaction_expenses_import_DB(data: TransactionExpensesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_transaction_expenses_import(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )