
from sqlalchemy import func
from app.models.portfolio import Document
from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings
from app.models.portfolio import InstrumentPurchasesAndSales
from app.models.portfolio import ContributionsAndWithdrawals
from app.models.portfolio import DividendsAndWithholdingTax
from app.models.portfolio import TransactionExpenses
# from app.service.instrument import resolve_known_instrument

def _iso_or_none(portfolio, field: str):
    if portfolio:
        value = getattr(portfolio, field, None)
    else:
        value = None
    
    if value:
        return value.isoformat()
    else:
        return None

# def ticker_or_name(instrument_name: str | None):
#     Known = resolve_known_instrument(instrument_name or "")

#     if Known:
#         return Known.ticker
#     else:
#         return instrument_name


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

def get_the_lowest_holdings_import_PDF(database,portfolioID):
    getInfo = database.query(Holdings.instrument_name, Holdings.total_cost).filter(Holdings.portfolio_id == portfolioID).order_by(Holdings.total_cost.asc()).first()

    if not getInfo:
        return {
            "name": None,
            "value": 0,
        }
    return {
        "name": getInfo.instrument_name,
        "value": float(getInfo.total_cost),
    }

def get_the_top_allocation_import_PDF(database,portfolioID):
    getInfo = database.query(Holdings.instrument_name, Holdings.weight_percentage).filter(Holdings.portfolio_id == portfolioID).order_by(Holdings.weight_percentage.desc()).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.instrument_name, "weight_percentage": float(allItems.weight_percentage or 0)})

    return returnAllArray


def get_trading_activity_import_PDF(database,portfolioID):
    getInfo = database.query(InstrumentPurchasesAndSales.transaction_name, func.sum(InstrumentPurchasesAndSales.value_zar)).filter(InstrumentPurchasesAndSales.portfolio_id == portfolioID).group_by(InstrumentPurchasesAndSales.transaction_name).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.transaction_name, "value": float(allItems[1] or 0)})

    return returnAllArray


def get_cash_flow_import_PDF(database,portfolioID):
    getInfo = database.query(ContributionsAndWithdrawals.transaction_name, func.sum(ContributionsAndWithdrawals.value_zar)).filter(ContributionsAndWithdrawals.portfolio_id == portfolioID).group_by(ContributionsAndWithdrawals.transaction_name).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.transaction_name, "value": float(allItems[1] or 0)})

    return returnAllArray

def get_dividend_income_import_PDF(database,portfolioID):
    getInfo = database.query(DividendsAndWithholdingTax.instrument_name, func.sum(DividendsAndWithholdingTax.gross_dividend),func.sum(DividendsAndWithholdingTax.withholding_tax),func.sum(DividendsAndWithholdingTax.net_dividend)).filter(DividendsAndWithholdingTax.portfolio_id == portfolioID).group_by(DividendsAndWithholdingTax.instrument_name).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.instrument_name, "gross_dividend": float(allItems[1] or 0), "withholding_tax": float(allItems[2] or 0),"net_dividend": float(allItems[3] or 0)})

    return returnAllArray


def get_expenses_import_PDF(database,portfolioID):
    getInfo = database.query(TransactionExpenses.narrative_name, func.sum(TransactionExpenses.value_zar)).filter(TransactionExpenses.portfolio_id == portfolioID).group_by(TransactionExpenses.narrative_name).all()

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.narrative_name, "value": float(allItems[1] or 0)})

    return returnAllArray