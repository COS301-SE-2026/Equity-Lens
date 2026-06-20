from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.import_pdf import ImportPdfRequest
from app.schemas.import_pdf import PortfolioRequest
from app.schemas.import_pdf import HoldingsRequest
from app.schemas.import_pdf import InstrumentPurchasesandSalesRequest
from app.schemas.import_pdf import TransactionCostsRequest
from app.schemas.import_pdf import ContributionsandWithdrawalsRequest
from app.schemas.import_pdf import DividendsandWithholdingTaxRequest
from app.schemas.import_pdf import transactionInterestRequest
from app.schemas.import_pdf import transactionExpensesRequest
from app.services.import_pdf import import_pdf_data
from app.services.import_pdf import save_portfolios_Import
from app.services.import_pdf import save_holdings_Import
from app.services.import_pdf import save_Instrument_Purchases_and_Sales_Import
from app.services.import_pdf import save_Transaction_Costs_Import
from app.services.import_pdf import save_Contributions_and_Withdrawals_Import
from app.services.import_pdf import save_Dividends_and_Withholding_Tax_Import
from app.services.import_pdf import save_transaction_Interest_Import
from app.services.import_pdf import save_transaction_Expenses_Import

router = APIRouter(prefix="/import-pdf", tags=["Import PDF"])

@router.post("/")
def import_pdf_data_db(data: ImportPdfRequest,db : Session = Depends(get_db)):
    return import_pdf_data(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_portfolios")
def save_portfolios_Import_db(data: PortfolioRequest,db : Session = Depends(get_db)):
    return save_portfolios_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_holdings")
def save_holdings_Import_db(data: HoldingsRequest,db : Session = Depends(get_db)):
    return save_holdings_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Instrument_Purchases_and_Sales")
def save_Instrument_Purchases_and_Sales_Import_db(data: InstrumentPurchasesandSalesRequest,db : Session = Depends(get_db)):
    return save_Instrument_Purchases_and_Sales_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9", 
        data=data
    )

@router.post("/save_Transaction_Costs")
def save_Transaction_Costs_Import_db(data: TransactionCostsRequest,db : Session = Depends(get_db)):
    return save_Transaction_Costs_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Contributions_and_Withdrawals")
def save_Contributions_and_Withdrawals_Import_db(data: ContributionsandWithdrawalsRequest,db : Session = Depends(get_db)):
    return save_Contributions_and_Withdrawals_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_Dividends_and_Withholding_Tax")
def save_Dividends_and_Withholding_Tax_Import_db(data: DividendsandWithholdingTaxRequest,db : Session = Depends(get_db)):
    return save_Dividends_and_Withholding_Tax_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_transaction_Interest")
def save_transaction_Interest_Import_db(data: transactionInterestRequest,db : Session = Depends(get_db)):
    return save_transaction_Interest_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )

@router.post("/save_transaction_Expenses")
def save_transaction_Expenses_Import_db(data: transactionExpensesRequest,db : Session = Depends(get_db)):
    return save_transaction_Expenses_Import(
        database=db,
        user_id="ec305d39-72fb-46a3-8e4a-2c61d2d466b9",
        data=data
    )
