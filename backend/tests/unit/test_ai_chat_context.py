import copy
from unittest.mock import patch

import pytest

from app.models.chat import ChatConversation, ChatMessages
from app.models.user import User
from app.services.ai_service import chat
from app.utils.exceptions import ConversationNotFoundException


def converse_recorder(captured, reply = "A response."):
    """Records the messages list of every real chat turn, ignoring title_creation calls."""
    def fake_converse(**kwargs):
        if "toolConfig" in kwargs:
            captured.append(copy.deepcopy(kwargs["messages"]))
        response = {"output": {"message": {"content": [{"text": reply}]}}}
        return response
    return fake_converse


@patch("app.services.ai_service.get_bedrock_client")
def test_another_users_conversation(mock_bedrock_client, db_session, test_user):
    other_user = User(
        email = "someone.else@example.com",
        full_name = "Someone Else",
        hashed_password = None,
        cognito_sub = "other-cognito-sub-456",
        is_active = True,
    )
    db_session.add(other_user)
    db_session.flush()

    their_conversation = ChatConversation(user_id = other_user.id, title = "Private")
    db_session.add(their_conversation)
    db_session.flush()
    db_session.add(ChatMessages(
        conversation_id = their_conversation.id,
        role = "user",
        content = "SECRET-HOLDING-NPN.JO",
    ))
    db_session.commit()

    with pytest.raises(ConversationNotFoundException):
        chat("A question?", db_session, test_user.id, their_conversation.id)

    mock_bedrock_client.assert_not_called()
    assert db_session.query(ChatMessages).filter(
        ChatMessages.conversation_id == their_conversation.id
    ).count() == 1