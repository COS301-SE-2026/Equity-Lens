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

router = APIRouter(prefix="/import-pdf", tags=["Import PDF"])

@router.post("/")
def ImportPdfDataDB(data: ImportPdfRequest,db : Session = Depends(get_db)):
    return ImportPdfData(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_portfolios")
def SavePortfoliosImportDB(data: PortfolioRequest,db : Session = Depends(get_db)):
    return SavePortfoliosImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_holdings")
def SaveHoldingsImportDB(data: HoldingsRequest,db : Session = Depends(get_db)):
    return SaveHoldingsImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Instrument_Purchases_and_Sales")
def SaveInstrumentPurchasesAndSalesImportDB(data: InstrumentPurchasesAndSalesRequest,db : Session = Depends(get_db)):
    return SaveInstrumentPurchasesAndSalesImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9", 
        data=data
    )

@router.post("/save_Transaction_Costs")
def SaveTransactionCostsImportDB(data: TransactionCostsRequest,db : Session = Depends(get_db)):
    return SaveTransactionCostsImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Contributions_and_Withdrawals")
def SaveContributionsAndWithdrawalsImportDB(data: ContributionsAndWithdrawalsRequest,db : Session = Depends(get_db)):
    return SaveContributionsAndWithdrawalsImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Dividends_and_Withholding_Tax")
def SaveDividendsAndWithholdingTaxImportDB(data: DividendsAndWithholdingTaxRequest,db : Session = Depends(get_db)):
    return SaveDividendsAndWithholdingTaxImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_transaction_Interest")
def SaveTransactionInterestImportDB(data: TransactionInterestRequest,db : Session = Depends(get_db)):
    return SaveTransactionInterestImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_transaction_Expenses")
def SaveTransactionExpensesImportDB(data: TransactionExpensesRequest,db : Session = Depends(get_db)):
    return SaveTransactionExpensesImport(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )
