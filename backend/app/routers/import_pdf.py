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
from app.services.import_pdf import ImportPdfData
from app.services.import_pdf import SavePortfoliosImport
from app.services.import_pdf import SaveHoldingsImport
from app.services.import_pdf import SaveInstrumentPurchasesAndSalesImport
from app.services.import_pdf import SaveTransactionCostsImport
from app.services.import_pdf import SaveContributionsAndWithdrawalsImport
from app.services.import_pdf import SaveDividendsAndWithholdingTaxImport
from app.services.import_pdf import SaveTransactionInterestImport
from app.services.import_pdf import SaveTransactionExpensesImport
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.models.portfolio import InstrumentType
from app.models.portfolio import NarrativeType
from app.models.portfolio import TransactionType


router = APIRouter(prefix="/import_pdf", tags=["Import PDF"])

@router.post("/")
def ImportPdfDataDB(data: ImportPdfRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return ImportPdfData(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_portfolios")
def SavePortfoliosImportDB(data: PortfolioRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SavePortfoliosImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_holdings")
def SaveHoldingsImportDB(data: HoldingsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveHoldingsImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_instrument_purchases_and_sales")
def SaveInstrumentPurchasesAndSalesImportDB(data: InstrumentPurchasesAndSalesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveInstrumentPurchasesAndSalesImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_transaction_costs")
def SaveTransactionCostsImportDB(data: TransactionCostsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveTransactionCostsImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_contributions_and_withdrawals")
def SaveContributionsAndWithdrawalsImportDB(data: ContributionsAndWithdrawalsRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveContributionsAndWithdrawalsImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_dividends_and_withholding_tax")
def SaveDividendsAndWithholdingTaxImportDB(data: DividendsAndWithholdingTaxRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveDividendsAndWithholdingTaxImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_transaction_interest")
def SaveTransactionInterestImportDB(data: TransactionInterestRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveTransactionInterestImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )

@router.post("/save_transaction_expenses")
def SaveTransactionExpensesImportDB(data: TransactionExpensesRequest,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    return SaveTransactionExpensesImport(
        database=db,
        user_id=CurrentUser.id,
        data=data
    )


@router.get("/get_instrument_type_id/{instrument_name}")
def GetInstrumentsTypeID(instrument_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(InstrumentType).filter(InstrumentType.instrument_name == instrument_name).first()
    return { "id" : str(data.id)}

@router.get("/get_narrative_type_id/{narrative_name}")
def GetNarrativesTypeID(narrative_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(NarrativeType).filter(NarrativeType.narrative_name == narrative_name).first()
    return { "id" : str(data.id)}

@router.get("/get_transaction_type_id/{transaction_name}")
def GetTranscationTypeID(transaction_name: str,db : Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    data = db.query(TransactionType).filter(TransactionType.transaction_name == transaction_name).first()
    return { "id" : str(data.id)}