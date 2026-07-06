from app.services.ai_service import get_user_portfolio_context

def test_portfolio_linked_no_data(db_session, test_user):
    ai_reply = get_user_portfolio_context(db_session, test_user.id)
    assert ai_reply == "User has not uploaded portfolio data."