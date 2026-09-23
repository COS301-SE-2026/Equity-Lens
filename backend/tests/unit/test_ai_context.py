from types import SimpleNamespace
from app.services.ai_context import build_history, estimate_tokens, message_tokens, fit_to_budget, HISTORY_MESSAGE_LIMIT, HISTORY_MESSAGE_TARGET


def row(role, content):
    """Stand-in for a ChatMessages ORM row - build_history only reads .role/.content."""
    return SimpleNamespace(role = role, content = content)


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("x" * 300) == 100


def test_message_tokens():
    message = {"role": "user", "content": [{"text": "a" * 300}, {"text": "b" * 600}]}
    assert message_tokens(message) == 300


def test_message_tokens_without_text():
    message = {"role": "user", "content": [{"toolUse": {"name": "get_stock_data"}}]}
    assert message_tokens(message) == 0


def test_current_message_budget():
    huge = "x" * 40_000
    prev = [row("user", "an old question"), row("assistant", "an old answer")]

    history = build_history(prev, huge, budget = 10)

    assert history == [{"role": "user", "content": [{"text": huge}]}]


def test_history():
    prev = [
        row("user", "a" * 4000),
        row("assistant", "b" * 4000),
        row("user", "c" * 400),
        row("assistant", "d" * 400),
    ]

    history = build_history(prev, "current question", budget = 400)

    assert [m["content"][0]["text"] for m in history] == ["c" * 400, "d" * 400, "current question"]
    assert [m["role"] for m in history] == ["user", "assistant", "user"]


def test_never_empty():
    history = build_history([row("assistant", "an orphaned reply")], "hello", budget = 1000)

    assert history == [{"role": "user", "content": [{"text": "hello"}]}]


def test_no_prior_messages():
    assert build_history([], "hello") == [{"role": "user", "content": [{"text": "hello"}]}]


def test_whole_conversation_fits():
    prev = [row("user", "q1"), row("assistant", "a1"), row("user", "q2"), row("assistant", "a2")]

    history = build_history(prev, "q3")

    assert [m["content"][0]["text"] for m in history] == ["q1", "a1", "q2", "a2", "q3"]



def test_message_limit():
    prev = [row("user" if i % 2 == 0 else "assistant", "hi") for i in range(100)]

    kept, dropped = fit_to_budget(prev, "a question")

    assert len(kept) == HISTORY_MESSAGE_TARGET
    assert len(dropped) == 100 - HISTORY_MESSAGE_TARGET
    assert [r.content for r in dropped + kept] == [r.content for r in prev]
    assert kept[0].role == "user"