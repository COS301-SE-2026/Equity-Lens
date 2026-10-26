from __future__ import annotations

import argparse
import logging
import sys

from app.database import SessionLocal
from app.scripts.seed_news import BENCHMARK_TICKERS, _held_tickers, seed_universe
from app.services import index_universe, universe_features
from app.services.instruments import KIND_ETF, KNOWN_INSTRUMENTS
from app.utils.stock_cache import get_cached_fundamentals, get_cached_price_histories

logger = logging.getLogger("warm_market_cache")
CHUNK = 25


def warm_universe(db) -> tuple[list[str], list[str]]:
    catalogue = {i.ticker for i in KNOWN_INSTRUMENTS.values() if i.ticker.endswith(".JO")}
    etfs = {i.ticker for i in KNOWN_INSTRUMENTS.values() if i.kind == KIND_ETF}
    prices = sorted(set(seed_universe()) | set(_held_tickers(db)) | BENCHMARK_TICKERS | catalogue)
    stocks = [t for t in prices if t.endswith(".JO") and t not in etfs]
    return prices, stocks


def warm_prices(tickers: list[str]) -> list[str]:
    failed = []
    for i in range(0, len(tickers), CHUNK):
        chunk = tickers[i : i + CHUNK]
        try:
            histories = get_cached_price_histories(chunk, period="1y", force_live=True)
        except Exception:
            logger.warning("price chunk starting %s failed", chunk[0], exc_info=True)
            failed.extend(chunk)
            continue
        failed.extend(t for t in chunk if histories.get(t) is None or histories[t].empty)
    return failed


def warm_fundamentals(tickers: list[str]) -> list[str]:
    failed = []
    for ticker in tickers:
        try:
            if not get_cached_fundamentals(ticker).get("info"):
                failed.append(ticker)
        except Exception:
            logger.warning("fundamentals failed for %s", ticker, exc_info=True)
            failed.append(ticker)
    return failed


def warm_explore(db) -> int:
    symbols = index_universe.market_universe("JSE", db)
    return len(universe_features.build_universe_features(symbols))


def warm(plan: bool, skip_prices: bool, skip_fundamentals: bool, skip_explore: bool) -> dict:
    db = SessionLocal()
    try:
        prices, stocks = warm_universe(db)
        summary = {"prices": len(prices), "fundamentals": len(stocks), "failed": {}}
        logger.info("%s tickers to price, %s shares for fundamentals", len(prices), len(stocks))
        if plan:
            return summary

        if not skip_prices:
            summary["failed"]["prices"] = warm_prices(prices)
        if not skip_fundamentals:
            summary["failed"]["fundamentals"] = warm_fundamentals(stocks)
        if not skip_explore:
            try:
                summary["explore"] = warm_explore(db)
                logger.info("explore: %s shares have features", summary["explore"])
            except Exception:
                logger.warning("explore universe failed", exc_info=True)
                summary["failed"]["explore"] = ["JSE"]

        for step, failed in summary["failed"].items():
            logger.info("%s: %s failed %s", step, len(failed), " ".join(failed))
        return summary
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fill the market data caches before a demo.")
    parser.add_argument("--plan", action="store_true", help="print the counts, call nothing")
    parser.add_argument("--skip-prices", action="store_true")
    parser.add_argument("--skip-fundamentals", action="store_true")
    parser.add_argument("--skip-explore", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    warm(args.plan, args.skip_prices, args.skip_fundamentals, args.skip_explore)
    return 0


if __name__ == "__main__":
    sys.exit(main())