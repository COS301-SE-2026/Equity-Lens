from app.services.ai_service import get_user_portfolio_context
from app.models.portfolio import Portfolios

def test_portfolio_linked_no_data(db_session, test_user):
    ai_reply = get_user_portfolio_context(db_session, test_user.id)
    assert ai_reply == "User has not uploaded portfolio data."

def test_portfolio_with_data(db_session, test_user):
    portfolio = Portfolios(
        user_id = test_user.id,
        account_number = "U23-536",
        portfolio_name = "The invesment portfolio of mine from Easy Equities"
    )

    db_session.add(portfolio)
    db_session.commit()

    output = get_user_portfolio_context(db_session, test_user.id)
    assert "The invesment portfolio of mine from Easy Equities" in output
    assert "U23-536" in output
    