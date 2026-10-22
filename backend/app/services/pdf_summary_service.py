from fastapi import HTTPException
from sqlalchemy import func

from app.models.portfolio import (
    ContributionsAndWithdrawals,
    DividendsAndWithholdingTax,
    Holdings,
    InstrumentPurchasesAndSales,
    Portfolios,
    TransactionExpenses,
)
from app.services.portfolio_service import BUY_MARKERS, SELL_MARKERS
HOLDING_VALUE = func.coalesce(Holdings.statement_value, Holdings.total_cost)


def checkPortfolioID(database, portfolioID, user_id):
    portfolio = (
        database.query(Portfolios)
        .filter(Portfolios.id == portfolioID, Portfolios.user_id == user_id)
        .first()
    )

    if portfolio is None:
        raise HTTPException(status_code=404, detail="The portfolio is not found")


def get_summary_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    PortfolioValue = (
        database.query(func.sum(Holdings.total_cost))
        .filter(Holdings.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    TotalHoldings = database.query(Holdings).filter(Holdings.portfolio_id == portfolioID).count()
    TotalPurchasesAndSales = (
        database.query(func.sum(InstrumentPurchasesAndSales.value_zar))
        .filter(InstrumentPurchasesAndSales.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    TotalContributionsAndWithdrawals = (
        database.query(func.sum(ContributionsAndWithdrawals.value_zar))
        .filter(ContributionsAndWithdrawals.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    TotalDividendsAndWithholdingTax = (
        database.query(func.sum(DividendsAndWithholdingTax.net_dividend))
        .filter(DividendsAndWithholdingTax.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    TotalTransactionExpenses = (
        database.query(func.sum(TransactionExpenses.value_zar))
        .filter(TransactionExpenses.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    StatementValue = (
        database.query(func.sum(HOLDING_VALUE))
        .filter(Holdings.portfolio_id == portfolioID)
        .scalar()
        or 0
    )
    WithStatementValue = (
        database.query(Holdings)
        .filter(Holdings.portfolio_id == portfolioID, Holdings.statement_value.isnot(None))
        .count()
    )
    StatementDate = (
        database.query(Portfolios.statement_end_date)
        .filter(Portfolios.id == portfolioID)
        .scalar()
    )

    if TotalHoldings and WithStatementValue == TotalHoldings:
        ValueBasis = "statement"
    elif WithStatementValue:
        ValueBasis = "mixed"
    else:
        ValueBasis = "cost"

    return {
        "PortfolioValue": float(PortfolioValue),
        "TotalHoldings": TotalHoldings,
        "TotalPurchasesAndSales": float(TotalPurchasesAndSales),
        "TotalTransactionCosts": 0,
        "TotalContributionsAndWithdrawals": float(TotalContributionsAndWithdrawals),
        "TotalDividendsAndWithholdingTax": float(TotalDividendsAndWithholdingTax),
        "TotalTransactionInterest": 0,
        "TotalTransactionExpenses": float(TotalTransactionExpenses),
        "StatementValue": float(StatementValue),
        "StatementDate": StatementDate.isoformat() if StatementDate else None,
        "ValueBasis": ValueBasis,
    }


def _value_total(database, portfolioID):
    return float(
        database.query(func.sum(HOLDING_VALUE))
        .filter(Holdings.portfolio_id == portfolioID)
        .scalar()
        or 0
    )


def _percent_of(value, total):
    return round(float(value or 0) / total * 100, 2) if total else None


def get_the_top_holdings_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    # ranked on the same value the card shows, cost alone could disagree with the allocation
    getInfo = (
        database.query(Holdings.instrument_name, HOLDING_VALUE.label("value"))
        .filter(Holdings.portfolio_id == portfolioID)
        .order_by(HOLDING_VALUE.desc())
        .all()
    )
    total = _value_total(database, portfolioID)

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append(
            {
                "name": allItems.instrument_name,
                "value": float(allItems.value or 0),
                "weight_percentage": _percent_of(allItems.value, total),
            }
        )

    return returnAllArray


def get_the_lowest_holdings_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(Holdings.instrument_name, HOLDING_VALUE.label("value"))
        .filter(Holdings.portfolio_id == portfolioID)
        .order_by(HOLDING_VALUE.asc())
        .first()
    )

    if not getInfo:
        return {
            "name": None,
            "value": 0,
            "weight_percentage": None,
        }
    return {
        "name": getInfo.instrument_name,
        "value": float(getInfo.value or 0),
        "weight_percentage": _percent_of(getInfo.value, _value_total(database, portfolioID)),
    }


def get_the_top_allocation_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(Holdings.instrument_name, HOLDING_VALUE.label("value"))
        .filter(Holdings.portfolio_id == portfolioID)
        .order_by(HOLDING_VALUE.desc())
        .all()
    )
    total = _value_total(database, portfolioID)

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append(
            {
                "name": allItems.instrument_name,
                # 0 rather than null keeps the pdf's empty-allocation guard working
                "weight_percentage": _percent_of(allItems.value, total) or 0.0,
            }
        )

    return returnAllArray


def get_trading_activity_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(
            InstrumentPurchasesAndSales.transaction_name,
            func.sum(InstrumentPurchasesAndSales.value_zar),
        )
        .filter(InstrumentPurchasesAndSales.portfolio_id == portfolioID)
        .group_by(InstrumentPurchasesAndSales.transaction_name)
        .all()
    )

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append(
            {
                "name": allItems.transaction_name,
                "value": float(allItems[1] or 0),
                "side": _trade_side(allItems.transaction_name),
            }
        )

    return returnAllArray


def _trade_side(transaction_name):
    name = (transaction_name or "").lower()
    if any(marker in name for marker in SELL_MARKERS):
        return "sell"
    if any(marker in name for marker in BUY_MARKERS):
        return "buy"
    return None


def get_cash_flow_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(
            ContributionsAndWithdrawals.transaction_name,
            func.sum(ContributionsAndWithdrawals.value_zar),
        )
        .filter(ContributionsAndWithdrawals.portfolio_id == portfolioID)
        .group_by(ContributionsAndWithdrawals.transaction_name)
        .all()
    )

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.transaction_name, "value": float(allItems[1] or 0)})

    return returnAllArray


def get_dividend_income_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(
            DividendsAndWithholdingTax.instrument_name,
            func.sum(DividendsAndWithholdingTax.gross_dividend),
            func.sum(DividendsAndWithholdingTax.withholding_tax),
            func.sum(DividendsAndWithholdingTax.net_dividend),
        )
        .filter(DividendsAndWithholdingTax.portfolio_id == portfolioID)
        .group_by(DividendsAndWithholdingTax.instrument_name)
        .all()
    )

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append(
            {
                "name": allItems.instrument_name,
                "gross_dividend": float(allItems[1] or 0),
                "withholding_tax": float(allItems[2] or 0),
                "net_dividend": float(allItems[3] or 0),
            }
        )

    return returnAllArray


def get_expenses_import_PDF(database, portfolioID, user_id):
    checkPortfolioID(database, portfolioID, user_id)
    getInfo = (
        database.query(TransactionExpenses.narrative_name, func.sum(TransactionExpenses.value_zar))
        .filter(TransactionExpenses.portfolio_id == portfolioID)
        .group_by(TransactionExpenses.narrative_name)
        .all()
    )

    returnAllArray = []

    for allItems in getInfo:
        returnAllArray.append({"name": allItems.narrative_name, "value": float(allItems[1] or 0)})

    return returnAllArray
