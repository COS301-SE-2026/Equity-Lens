import logging

from app.services.exposure_engine import Feature
from app.utils.stock_cache import get_cached_fundamentals

logger = logging.getLogger(__name__)


def _local_float_proxy(info: dict) -> float | None:
    float_shares = info.get("floatShares")
    shares_out = info.get("sharesOutstanding")
    if not float_shares or not shares_out:
        return None
    return round((float_shares / shares_out) * 100, 2)


def build_feature(ticker: str) -> Feature | None:
    cached = get_cached_fundamentals(ticker)
    info = cached.get("info") or {}
    if not info:
        return None

    market_cap = info.get("marketCap")
    sector = info.get("sector")
    local_float = _local_float_proxy(info)

    if market_cap is None or sector is None or local_float is None:
        logger.info("Skipping %s from universe - incomplete fundamentals", ticker)
        return None

    dividend_yield = info.get("dividendYield") or 0
    name = info.get("longName") or info.get("shortName") or ticker.upper()

    return Feature(
        ticker=ticker.upper().removesuffix(".JO"),
        name=name,
        sector=sector,
        market_cap=round(market_cap / 1e9, 2),
        local_float_pct=local_float,
        dividend_yield=round(dividend_yield, 2),
    )


def build_universe_features(tickers: list[str]) -> list[Feature]:
    features = []
    for ticker in tickers:
        feature = build_feature(ticker)
        if feature is not None:
            features.append(feature)
    return features