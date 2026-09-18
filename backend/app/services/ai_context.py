HISTORY_TOKEN_BUDGET = 10000
HISTORY_MESSAGE_LIMIT = 60
CHARS_PER_TOKEN = 3


def estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def message_tokens(message: dict) -> int:
    return sum(
        estimate_tokens(block.get("text", ""))
        for block in message.get("content", [])
    )


def _to_message(row) -> dict:
    return {"role": row.role, "content": [{"text": row.content}]}


def fit_to_budget(
    prev_messages,
    user_message: str,
    budget: int = HISTORY_TOKEN_BUDGET,
    max_messages: int = HISTORY_MESSAGE_LIMIT
    ) -> tuple[list, list]:
    """Split ORM rows into (kept, dropped), both in chronological order.

    kept is the contiguous suffix that fits under both caps once the current user message has been counted, 
    trimmed so it opens on a user turn. dropped is everything before it - the rows a summary has to cover.

    Two caps, whichever binds first: max_messages is the intent (roughly the last
    60 turns), budget is the guard against one oversized message blowing the call.
    """
    spent = estimate_tokens(user_message)

    cut = len(prev_messages)
    for i in range(len(prev_messages) - 1, -1, -1):
        if len(prev_messages) - i > max_messages:
            break
        cost = message_tokens(_to_message(prev_messages[i]))
        if spent + cost > budget:
            break
        spent += cost
        cut = i

    while cut < len(prev_messages) and prev_messages[cut].role != "user":
        cut += 1

    return list(prev_messages[cut:]), list(prev_messages[:cut])


def build_history(
    prev_messages,
    user_message: str,
    budget: int = HISTORY_TOKEN_BUDGET,
    max_messages: int = HISTORY_MESSAGE_LIMIT
    ) -> list[dict]:
    """Convert ORM rows to Converse messages, newest-first until a cap is hit.
    Returns chronological order. Must satisfy:
        the current user message is always included, even if it alone exceeds budget
        the returned list starts with a user message
        never returns an empty list
    """
    kept, _ = fit_to_budget(prev_messages, user_message, budget, max_messages)
    current = {"role": "user", "content": [{"text": user_message}]}
    return [_to_message(row) for row in kept] + [current]