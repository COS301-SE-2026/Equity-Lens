
from sqlalchemy import func
from app.models.portfolio import Document
from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings
from app.models.portfolio import InstrumentPurchasesAndSales
from app.models.portfolio import ContributionsAndWithdrawals
from app.models.portfolio import DividendsAndWithholdingTax
from app.models.portfolio import TransactionExpenses


def get_summary_import_PDF(database,portfolioID):
    PortfolioValue = database.query(func.sum(Holdings.total_cost)).filter(Holdings.portfolio_id == portfolioID).scalar() or 0
    TotalHoldings = database.query(Holdings).filter(Holdings.portfolio_id == portfolioID).count() 
    TotalPurchasesAndSales = database.query(func.sum(InstrumentPurchasesAndSales.value_zar)).filter(InstrumentPurchasesAndSales.portfolio_id == portfolioID).scalar() or 0
    TotalContributionsAndWithdrawals = database.query(func.sum(ContributionsAndWithdrawals.value_zar)).filter(ContributionsAndWithdrawals.portfolio_id == portfolioID).scalar() or 0
    TotalDividendsAndWithholdingTax = database.query(func.sum(DividendsAndWithholdingTax.net_dividend)).filter(DividendsAndWithholdingTax.portfolio_id == portfolioID).scalar() or 0
    TotalTransactionExpenses = database.query(func.sum(TransactionExpenses.value_zar)).filter(TransactionExpenses.portfolio_id == portfolioID).scalar() or 0
    
    return{
        "PortfolioValue" : float(PortfolioValue),
        "TotalHoldings" : TotalHoldings,
        "TotalPurchasesAndSales" : float(TotalPurchasesAndSales),
        "TotalTransactionCosts" : 0,
        "TotalContributionsAndWithdrawals" : float(TotalContributionsAndWithdrawals),
        "TotalDividendsAndWithholdingTax" : float(TotalDividendsAndWithholdingTax),
        "TotalTransactionInterest" : 0,
        "TotalTransactionExpenses" : float(TotalTransactionExpenses),

    }

def get_the_top_holdings_import_PDF(database,portfolioID):
    getInfo = database.query(Holdings.instrument_name, Holdings.total_cost).filter(Holdings.portfolio_id == portfolioID).order_by(Holdings.total_cost.desc()).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.instrument_name, "value": float(allItems.total_cost or 0)})

    return returnAllArray

def get_the_top_allocation_import_PDF(database,portfolioID):
    getInfo = database.query(Holdings.instrument_name, Holdings.weight_percentage).filter(Holdings.portfolio_id == portfolioID).order_by(Holdings.weight_percentage.desc()).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.instrument_name, "weight_percentage": float(allItems.weight_percentage or 0)})

    return returnAllArray
