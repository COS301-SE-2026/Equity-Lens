HISTORY_TOKEN_BUDGET = 4000
CHARS_PER_TOKEN = 3


def estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def message_tokens(message: dict) -> int:
    return sum(
        estimate_tokens(block.get("text", ""))
        for block in message.get("content", [])
    )


def build_history(
    prev_messages,
    user_message: str,
    budget: int = HISTORY_TOKEN_BUDGET
    ) -> list[dict]:
    """Convert ORM rows to Converse messages, newest-first until budget is spent.

    Returns chronological order. Must satisfy:
        the current user message is always included, even if it alone exceeds budget
        the returned list starts with a user message
        never returns an empty list
    """
    current = {"role": "user", "content": [{"text": user_message}]}
    spent = message_tokens(current)

    kept = []
    for row in reversed(prev_messages):
        message = {"role": row.role, "content": [{"text": row.content}]}
        cost = message_tokens(message)
        if spent + cost > budget:
            break
        kept.append(message)
        spent += cost

    kept.reverse()
    while kept and kept[0]["role"] != "user":
        kept.pop(0)

    return kept + [current]