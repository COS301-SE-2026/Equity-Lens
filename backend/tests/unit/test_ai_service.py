from app.services.ai_service import get_user_portfolio_context, chat
from app.models.portfolio import Portfolios, Document
from unittest.mock import MagicMock, patch
from app.models.chat import ChatMessages
import pytest
from app.routers.ai_chat import ChatRequest

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

    document = Document(
        user_id = test_user.id,
        file_name = "portfolio.pdf"
    )
    db_session.add(document)

    db_session.commit()

    output = get_user_portfolio_context(db_session, test_user.id)
    assert "The invesment portfolio of mine from Easy Equities" in output
    assert "U23-536" in output
    assert "portfolio.pdf" in output


@patch("app.services.ai_service.get_bedrock_client")
def test_new_chat(mock_bedrock_client, db_session, test_user):
    mocked_client = MagicMock()
    mocked_client.converse.return_value = {"output": {"message": {"content": [{"text": "A response."}] }}}
    
    mock_bedrock_client.return_value = mocked_client
    reply, conversation_id = chat("A question?" ,db_session, test_user.id)

    assert reply == "A response."
    assert conversation_id is not None

    messages = db_session.query(ChatMessages).filter_by(conversation_id = conversation_id).all()
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert messages[0].content == "A question?"
    assert messages[1].content == "A response."


@patch("app.services.ai_service.get_bedrock_client")
def test_existing_chat(mock_bedrock_client, db_session, test_user):
    mocked_client = MagicMock()
    mocked_client.converse.return_value = {
        "output": {"message": {"content": [{"text": "A response."}] }}
    }
    
    mock_bedrock_client.return_value = mocked_client
    reply, conversation_id = chat("A question?" ,db_session, test_user.id)

    assert reply == "A response."
    assert conversation_id is not None

    mocked_client.converse.return_value = {
        "output": {"message": {"content": [{"text": "A second response."}] }}
    }
    
    reply2, conversation_id2 = chat("A second question?" ,db_session, test_user.id, conversation_id)

    assert reply2 == "A second response."
    assert conversation_id2 == conversation_id

    messages = db_session.query(ChatMessages).filter_by(conversation_id = conversation_id).all()
    assert len(messages) == 4
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert messages[0].content == "A question?"
    assert messages[1].content == "A response."
    assert messages[2].role == "user"
    assert messages[3].role == "assistant"
    assert messages[2].content == "A second question?"
    assert messages[3].content == "A second response."


def test_empty_message():
    with pytest.raises(ValueError):
        ChatRequest(message = "", conversation_id = None)    