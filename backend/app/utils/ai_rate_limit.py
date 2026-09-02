from collections import deque
from math import ceil
from threading import Lock
from time import monotonic

_HITS: dict[str, deque[float]] = {}
_LOCK = Lock()

def check_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """
        Returns (allowed, retry_after_seconds).
        A successful check records the hit and a rejected one does not, so being blocked never extends your own block.
    """
    now = monotonic()
    cutoff = now - window_seconds

    with _LOCK:
        hits = _HITS.setdefault(key, deque())

        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= limit:
            retry_after = max(1, ceil(hits[0] + window_seconds - now))
            return False, retry_after

        hits.append(now)
        return True, 0