from datetime import date

import pytest
from fastapi import HTTPException

from app.models.portfolio import Holdings, InstrumentPurchasesAndSales, Portfolios
from app.models.user import User
from app.routers.pdf_summary import HoldingResponse, SummaryResponse, TradingResponse
from app.services import pdf_summary_service as summary_service
from app.services.portfolio_snapshot_service import build_snapshot


@pytest.fixture
def portfolio(db_session, test_user):
    row = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="Mine",
        statement_end_date=date(2026, 9, 29),
    )
    db_session.add(row)
    db_session.commit()
    return row


def hold(db_session, portfolio, name, cost, statement_value=None, weight=None):
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name=name, ticker=" ", sector=" ", quantity=1,
        total_cost=cost, cost_price=cost, weight_percentage=weight,
        statement_value=statement_value,
    ))
    db_session.commit()


def summary(db_session, portfolio, user):
    return summary_service.get_summary_import_PDF(db_session, portfolio.id, user.id)


def test_every_holding_with_a_statement_value_is_valued_at_the_statement(
    db_session, portfolio, test_user
):
    hold(db_session, portfolio, "Naspers", 1000, statement_value=1200)
    hold(db_session, portfolio, "MTN", 500, statement_value=400)

    result = summary(db_session, portfolio, test_user)

    assert result["StatementValue"] == 1600.0
    assert result["PortfolioValue"] == 1500.0
    assert result["ValueBasis"] == "statement"
    assert result["StatementDate"] == "2026-09-29"


def test_a_holding_without_one_falls_back_to_its_cost(db_session, portfolio, test_user):
    hold(db_session, portfolio, "Naspers", 1000, statement_value=1200)
    hold(db_session, portfolio, "MTN", 500)

    result = summary(db_session, portfolio, test_user)

    assert result["StatementValue"] == 1700.0
    assert result["ValueBasis"] == "mixed"


def test_an_excel_import_without_statement_values_says_it_is_cost(
    db_session, portfolio, test_user
):
    hold(db_session, portfolio, "Naspers", 1000)
    hold(db_session, portfolio, "MTN", 500)

    result = summary(db_session, portfolio, test_user)

    assert result["StatementValue"] == result["PortfolioValue"] == 1500.0
    assert result["ValueBasis"] == "cost"


def test_an_empty_portfolio_is_cost_with_nothing_in_it(db_session, portfolio, test_user):
    result = summary(db_session, portfolio, test_user)

    assert result["StatementValue"] == 0.0
    assert result["ValueBasis"] == "cost"


def test_top_lowest_and_allocation_all_rank_on_the_statement_value(
    db_session, portfolio, test_user
):
    hold(db_session, portfolio, "Naspers", 1000, statement_value=300, weight=66.67)
    hold(db_session, portfolio, "MTN", 500, statement_value=900, weight=33.33)
    ids = (db_session, portfolio.id, test_user.id)

    top = summary_service.get_the_top_holdings_import_PDF(*ids)
    lowest = summary_service.get_the_lowest_holdings_import_PDF(*ids)
    allocation = summary_service.get_the_top_allocation_import_PDF(*ids)

    assert top == [
        {"name": "MTN", "value": 900.0, "weight_percentage": 75.0},
        {"name": "Naspers", "value": 300.0, "weight_percentage": 25.0},
    ]
    assert lowest == {"name": "Naspers", "value": 300.0, "weight_percentage": 25.0}
    assert allocation == [
        {"name": "MTN", "weight_percentage": 75.0},
        {"name": "Naspers", "weight_percentage": 25.0},
    ]


def test_an_excel_import_keeps_the_weights_it_was_imported_with(
    db_session, portfolio, test_user
):
    hold(db_session, portfolio, "Naspers", 96247.97, weight=42.42)
    hold(db_session, portfolio, "FirstRand", 15540.00, weight=6.85)
    hold(db_session, portfolio, "Rest", 115117.13, weight=50.73)

    allocation = summary_service.get_the_top_allocation_import_PDF(
        db_session, portfolio.id, test_user.id
    )

    assert [row["weight_percentage"] for row in allocation] == [50.73, 42.42, 6.85]


def test_trades_are_split_into_buys_and_sells_by_the_ledger_markers(
    db_session, portfolio, test_user
):
    for name, value in [("Buy", 100), ("Buy", 50), ("Sale", 40), ("Purchase", 10), ("Fee", 1)]:
        db_session.add(InstrumentPurchasesAndSales(
            portfolio_id=portfolio.id, transaction_name=name, value_zar=value,
        ))
    db_session.commit()

    trading = summary_service.get_trading_activity_import_PDF(
        db_session, portfolio.id, test_user.id
    )

    assert sorted((row["name"], row["value"], row["side"]) for row in trading) == [
        ("Buy", 150.0, "buy"),
        ("Fee", 1.0, None),
        ("Purchase", 10.0, "buy"),
        ("Sale", 40.0, "sell"),
    ]


def test_another_users_portfolio_is_still_not_found(db_session, portfolio):
    stranger = User(email="other@example.com", full_name="Other", cognito_sub="other-sub",
                    is_active=True)
    db_session.add(stranger)
    db_session.commit()

    with pytest.raises(HTTPException) as caught:
        summary(db_session, portfolio, stranger)

    assert caught.value.status_code == 404


def test_the_responses_and_the_snapshot_still_accept_the_new_shape(
    db_session, portfolio, test_user
):
    hold(db_session, portfolio, "Naspers", 1000, statement_value=300, weight=25.0)
    hold(db_session, portfolio, "MTN", 500, statement_value=900, weight=75.0)
    ids = (db_session, portfolio.id, test_user.id)
    result = summary(db_session, portfolio, test_user)
    top = summary_service.get_the_top_holdings_import_PDF(*ids)
    lowest = summary_service.get_the_lowest_holdings_import_PDF(*ids)
    trading = summary_service.get_trading_activity_import_PDF(*ids)

    SummaryResponse(**result)
    [HoldingResponse(**row) for row in top]
    [TradingResponse(**row) for row in trading]
    snapshot = build_snapshot(
        portfolio_id=str(portfolio.id), summary=result, top_holdings=top, allocation=[],
        trading_activity=trading, cash_flow=[], dividend_income=[], lowest_holding=lowest,
        portfolio_news=[], market_news=[], analytics=[],
    )["snapshot"]

    insights = {i["type"]: i["data"] for i in snapshot["insights"]}
    assert insights["largest_holdings"]["name"] == "MTN"
    assert insights["smallest_holding"]["name"] == "Naspers"
    assert snapshot["summary"]["StatementValue"] == 1200.0
