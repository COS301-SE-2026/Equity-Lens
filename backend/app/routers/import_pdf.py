from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.import_pdf import ImportPdfRequest
from app.schemas.import_pdf import PortfolioRequest
from app.schemas.import_pdf import HoldingsRequest
from app.schemas.import_pdf import InstrumentPurchasesAndSalesRequest
from app.schemas.import_pdf import TransactionCostsRequest
from app.schemas.import_pdf import ContributionsAndWithdrawalsRequest
from app.schemas.import_pdf import DividendsAndWithholdingTaxRequest
from app.schemas.import_pdf import TransactionInterestRequest
from app.schemas.import_pdf import TransactionExpensesRequest
from app.services.import_pdf import import_Pdf_data
from app.services.import_pdf import save_portfolios_import
from app.services.import_pdf import save_holdings_import
from app.services.import_pdf import save_instrument_purchases_and_sales_import
from app.services.import_pdf import save_transaction_costs_import
from app.services.import_pdf import save_contributions_and_withdrawals_import
from app.services.import_pdf import save_dividends_and_withholding_tax_import
from app.services.import_pdf import save_transaction_interest_import
from app.services.import_pdf import save_transaction_expenses_import
from app.dependencies import get_current_user
from app.models.portfolio import InstrumentType
from app.models.portfolio import NarrativeType
from app.models.portfolio import TransactionType
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

@router.post("/save_transaction_costs")
def save_transaction_costs_import_DB(data: TransactionCostsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_transaction_costs_import(
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

@router.post("/save_transaction_interest")
def save_transaction_interest_import_DB(data: TransactionInterestRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return save_transaction_interest_import(
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


@router.get("/get_instrument_type_id/{instrument_name}")
def get_instruments_typeID(instrument_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(InstrumentType).filter(InstrumentType.instrument_name == instrument_name).first()
    return { "id" : str(data.id)}

@router.get("/get_narrative_type_id/{narrative_name}")
def get_narratives_typeID(narrative_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(NarrativeType).filter(NarrativeType.narrative_name == narrative_name).first()
    return { "id" : str(data.id)}

@router.get("/get_transaction_type_id/{transaction_name}")
def get_transcation_typeID(transaction_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(TransactionType).filter(TransactionType.transaction_name == transaction_name).first()
    return { "id" : str(data.id)}