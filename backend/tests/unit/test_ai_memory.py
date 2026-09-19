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


