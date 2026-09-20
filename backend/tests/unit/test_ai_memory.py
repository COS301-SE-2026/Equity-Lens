import pytest
from unittest.mock import MagicMock, patch
from app.models.user import User
from app.models.chat import ChatConversation, ChatMessages, UserMemory
from app.services.ai_memory import _parse_facts, MAX_FACTS_PER_USER
from app.services.ai_service import chat

BACKTICKS = "`" * 3


def memory_client(fact_reply = "[]", summary_reply = "The user asked about Sasol.", main_reply = "An answer."):  
    captured = {"system_prompts": [], "summary_calls": 0, "fact_calls": 0}

    def fake_converse(**kwargs):
        system = kwargs.get("system", [{}])[0].get("text", "")

        if "running summary" in system:
            captured["summary_calls"] += 1
            if isinstance(summary_reply, Exception):
                raise summary_reply
            return {"output": {"message": {"content": [{"text": summary_reply}]}}}

        if "extract long-term facts" in system:
            captured["fact_calls"] += 1
            if isinstance(fact_reply, Exception):
                raise fact_reply
            return {"output": {"message": {"content": [{"text": fact_reply}]}}}

        if "name chat conversations" in system:
            return {"output": {"message": {"content": [{"text": "Test Chat"}]}}}

        captured["system_prompts"].append(system)
        return {"output": {"message": {"content": [{"text": main_reply}]}}}

    client = MagicMock()
    client.converse.side_effect = fake_converse
    return client, captured


def fill(db_session, conversation_id, pairs = 40):
    for i in range(pairs):
        db_session.add(ChatMessages(conversation_id = conversation_id, role = "user", content = f"q{i} " + "x" * 2000))
        db_session.add(ChatMessages(conversation_id = conversation_id, role = "assistant", content = f"a{i} " +  "y" * 2000))
    db_session.commit()


@pytest.mark.parametrize("raw, expected", [
    ('["retiring in 15 years", "avoids mining"]', ["retiring in 15 years", "avoids mining"]),
    (BACKTICKS + 'json\n["a fact"]\n' + BACKTICKS, ["a fact"]),      
    (BACKTICKS + '\n["a fact"]\n' + BACKTICKS, ["a fact"]),         
    ("Sure! Here are the facts.", []),                              
    ('{"facts": ["x"]}', []),                                        
    ('["ok", "", "  "]', ["ok"]),                             
    ('["1","2","3","4","5","6","7"]', ["1", "2", "3", "4", "5"]),   
    ('["' + "x" * 400 + '"]', ["x" * 300]),                         
])
def test_parse_facts_handles_model_output(raw, expected):
    assert _parse_facts(raw) == expected


@patch("app.services.ai_service.get_bedrock_client")
def test_fact_saved(mock_bedrock_client, db_session, test_user):
    client, captured = memory_client(fact_reply = '["User plans to retire in 15 years"]')
    mock_bedrock_client.return_value = client

    _, conversation_id, saved_facts = chat("I want to retire in 15 years", db_session, test_user.id)

    facts = db_session.query(UserMemory).filter(UserMemory.user_id == test_user.id).all()
    assert [f.fact for f in facts] == ["User plans to retire in 15 years"]
    assert saved_facts == ["User plans to retire in 15 years"]

    chat("what next?", db_session, test_user.id, conversation_id)
    assert "User plans to retire in 15 years" in captured["system_prompts"][-1]
    assert "<user_memory>" in captured["system_prompts"][-1]
    assert captured["summary_calls"] == 0      


@patch("app.services.ai_service.get_bedrock_client")
def test_overflow_summarised(mock_bedrock_client, db_session, test_user):
    client, captured = memory_client(summary_reply = "Earlier the user asked about MTN.")
    mock_bedrock_client.return_value = client

    _, conversation_id, _ = chat("first question", db_session, test_user.id)
    fill(db_session, conversation_id)
    chat("a later question", db_session, test_user.id, conversation_id)

    conversation = db_session.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()     
    assert captured["summary_calls"] == 1
    assert conversation.summary == "Earlier the user asked about MTN."
    assert conversation.summarised is not None
    assert "Earlier the user asked about MTN." in captured["system_prompts"][-1]


@patch("app.services.ai_service.get_bedrock_client")
def test_failures(mock_bedrock_client, db_session, test_user):
    client, _ = memory_client(summary_reply = "First summary.")
    mock_bedrock_client.return_value = client

    _, conversation_id, _ = chat("first question", db_session, test_user.id)
    fill(db_session, conversation_id)
    chat("second question", db_session, test_user.id, conversation_id)

    conversation = db_session.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()     
    watermark = conversation.summarised

    client, _ = memory_client(summary_reply = RuntimeError("bedrock exploded"), fact_reply = RuntimeError("bedrock exploded"))
    mock_bedrock_client.return_value = client
    fill(db_session, conversation_id)
    reply, _, _ = chat("third question", db_session, test_user.id, conversation_id)

    assert reply == "An answer."
    db_session.refresh(conversation)
    assert conversation.summary == "First summary."
    assert conversation.summarised == watermark


@patch("app.services.ai_service.get_bedrock_client")
def test_memories_cap(mock_bedrock_client, db_session, test_user):
    other_user = User(email = "other@example.com", full_name = "Other", hashed_password = None, cognito_sub = "other-sub-789", is_active = True)
    db_session.add(other_user)
    db_session.flush()
    db_session.add(UserMemory(user_id = other_user.id, fact = "SECRET-OTHER-USER-FACT"))
    for i in range(MAX_FACTS_PER_USER):
        db_session.add(UserMemory(user_id = test_user.id, fact = f"existing fact {i}"))
    db_session.commit()

    client, captured = memory_client(fact_reply = '["one more fact"]')
    mock_bedrock_client.return_value = client

    chat("a question", db_session, test_user.id)

    assert "SECRET-OTHER-USER-FACT" not in captured["system_prompts"][0]
    assert db_session.query(UserMemory).filter(UserMemory.user_id == test_user.id).count() == MAX_FACTS_PER_USER 
    assert captured["fact_calls"] == 0      
