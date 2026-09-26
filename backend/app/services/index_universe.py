import logging
import threading
from datetime import datetime, timedelta, timezone

import yfinance as yf
from sqlalchemy.orm import Session

from app.models.market_universe_snapshot import MarketUniverseSnapshot
from app.services import universe_features

logger = logging.getLogger(__name__)

UNIVERSE_SIZE = 120
_TTL = timedelta(days=7)
_RETRY = timedelta(hours=1)
_MIN_MARKET_CAP_BN = {"JSE": 1.0}

_QUERIES = {
    "JSE": yf.EquityQuery(
        "and",
        [
            yf.EquityQuery("eq", ["region", "za"]),
            yf.EquityQuery("eq", ["exchange", "JNB"]),
        ],
    ),
}
_SYMBOL_OK = {
    "JSE": lambda s: s.endswith(".JO"),
}
_cache: dict[str, dict] = {}
_LOCKS = {market: threading.Lock() for market in _QUERIES}


class UniverseUnavailable(Exception):
    """Raised when the screener fails and no previous universe exists."""


def _build(market: str) -> list[str]:
    response = yf.screen(
        _QUERIES[market],
        sortField="intradaymarketcap",
        sortAsc=False,
        size=UNIVERSE_SIZE * 2,
    )
    candidates = [
        q["symbol"]
        for q in response.get("quotes", [])
        if _SYMBOL_OK[market](q.get("symbol", ""))
    ]
    pairs = [(s, universe_features.build_feature(s)) for s in candidates]
    eligible = [
        (s, f)
        for s, f in pairs
        if f is not None and f.market_cap >= _MIN_MARKET_CAP_BN[market]
    ]
    top = sorted(eligible, key=lambda p: p[1].market_cap, reverse=True)[
        :UNIVERSE_SIZE
    ]
    return sorted(s for s, _ in top)


def market_universe(market: str, db: Session) -> list[str]:
    entry = _cache.get(market)
    if entry and datetime.now(timezone.utc) - entry["built_at"] < _TTL:
        return entry["symbols"]
    with _LOCKS[market]:
        return _load_or_build(market,db)

def _load_or_build(market: str, db: Session) -> list[str]:
    now = datetime.now(timezone.utc)

    entry = _cache.get(market)
    if entry is None:
        row = db.get(MarketUniverseSnapshot, market)
        if row is not None:
            entry = {"symbols": row.symbols, "built_at": row.built_at}
            _cache[market] = entry

    if entry and now - entry["built_at"] < _TTL:
        return entry["symbols"]

    try:
        symbols = _build(market)
    except Exception:
        logger.exception("%s screener failed", market)
        symbols = []

    if symbols:
        db.merge(
            MarketUniverseSnapshot(market=market, symbols=symbols, built_at=now)
        )
        db.commit()
        _cache[market] = {"symbols": symbols, "built_at": now}
        return symbols

    if entry:
        logger.warning(
            "Serving stale %s universe, retrying in %s", market, _RETRY
        )
        entry["built_at"] = now - _TTL + _RETRY
        return entry["symbols"]

    raise UniverseUnavailable(market)