from __future__ import annotations

import argparse
import logging
import sys

import pandas as pd
from sqlalchemy import select

from app.database import SessionLocal
from app.models.market_data import MarketData
from app.utils.stock_cache import PRICE_COLUMNS, hundredfold_jump, repair_unit_slips

logger = logging.getLogger("repair_price_units")


def _jse_tickers(db) -> list[str]:
    stmt = select(MarketData.ticker).where(MarketData.ticker.like("%.JO")).distinct()
    return sorted(db.scalars(stmt))


def _runs(closes: list[float]) -> list[tuple[int, int]]:
    jumps = [
        i
        for i in range(1, len(closes))
        if closes[i - 1] > 0 and closes[i] > 0 and hundredfold_jump(closes[i - 1], closes[i]) != 0
    ]
    return [
        (jumps[k], jumps[k + 1] - 1 if k + 1 < len(jumps) else len(closes) - 1)
        for k in range(0, len(jumps), 2)
    ]


def repair(tickers: list[str], apply: bool = False) -> int:
    db = SessionLocal()
    try:
        total = 0
        for ticker in [t.upper() for t in tickers] or _jse_tickers(db):
            rows = list(
                db.scalars(
                    select(MarketData).where(MarketData.ticker == ticker).order_by(MarketData.date)
                )
            )
            if not rows:
                continue
            history = pd.DataFrame(
                {
                    "Open": [float(r.open) for r in rows],
                    "High": [float(r.high) for r in rows],
                    "Low": [float(r.low) for r in rows],
                    "Close": [float(r.close) for r in rows],
                    "Prev Close": [float(r.prev_close) for r in rows],
                },
                index=pd.DatetimeIndex([pd.Timestamp(r.date) for r in rows]),
            )
            fixed, days = repair_unit_slips(ticker, history)

            for i, row in enumerate(rows):
                if row.date not in days:
                    continue
                new = [float(fixed[column].iloc[i]) for column in PRICE_COLUMNS]
                logger.info("%s %s close %s -> %s", ticker, row.date, float(row.close), new[3])
                if apply:
                    row.open, row.high, row.low, row.close = new
                    if i + 1 < len(rows):
                        rows[i + 1].prev_close = new[3]
            total += len(days)

            for start, end in _runs(fixed["Close"].tolist()):
                logger.warning(
                    "%s %s to %s looks 100x off for more than a day, needs a look",
                    ticker, rows[start].date, rows[end].date,
                )

        if apply:
            db.commit()
        return total
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fix single days a JSE price was stored in rand.")
    parser.add_argument("tickers", nargs="*", help="only these tickers, default every .JO ticker")
    parser.add_argument("--apply", action="store_true", help="write the repairs, not a dry run")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    count = repair(args.tickers, apply=args.apply)
    logger.info("%s %s prices", "repaired" if args.apply else "would repair", count)
    return 0


if __name__ == "__main__":
    sys.exit(main())