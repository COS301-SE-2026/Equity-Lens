from unittest.mock import MagicMock, patch
from app.models.chat import ChatConversation, ChatMessages

def test_delete_conversation(client, db_session, test_user, auth_headers):

    del_conversation = ChatConversation(user_id = test_user.id, title = "Conversation to delete")

    db_session.add(del_conversation)
    db_session.commit()

    conv_id = del_conversation.id
    db_session.add(ChatMessages(conversation_id = conv_id, role = "user", content = "Question."))
    db_session.add(ChatMessages(conversation_id = conv_id, role = "assistant", content = "Answer."))
    db_session.commit()

    output = client.delete(f"/api/ai_chat/conversations/{conv_id}/", headers = auth_headers)
    assert output.status_code == 200
    assert output.json() == {"detail": "Conversation deleted"}

    all_convs = db_session.query(ChatConversation).filter_by(id = conv_id).all()
    assert len(all_convs) == 0

    messages_in_conv = db_session.query(ChatMessages).filter_by(conversation_id = conv_id).all()
    assert len(messages_in_conv) == 0

def test_get_messages(client, db_session, test_user, auth_headers):
    conversation = ChatConversation(user_id = test_user.id, title = "Conversation")

    db_session.add(conversation)
    db_session.commit()

    conv_id = conversation.id
    db_session.add(ChatMessages(conversation_id = conv_id, role = "user", content = "Question."))
    db_session.add(ChatMessages(conversation_id = conv_id, role = "assistant", content = "Answer."))
    db_session.commit()

    output = client.get(f"/api/ai_chat/conversations/{conv_id}/messages/", headers = auth_headers)
    assert output.status_code == 200

    msgs = output.json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Question."
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Answer."


def test_renaming_conversations(client, db_session, test_user, auth_headers):
    conversation = ChatConversation(user_id = test_user.id, title = "Current")

    db_session.add(conversation)
    db_session.commit()

    conv_id = conversation.id

    output = client.put(f"/api/ai_chat/conversations/{conv_id}/", json = {"title": "Renamed"}, headers = auth_headers)
    assert output.status_code == 200 
    assert output.json() == {"id": str(conv_id), "title": "Renamed"}

    db_session.refresh(conversation)
    assert conversation.title == "Renamed"
