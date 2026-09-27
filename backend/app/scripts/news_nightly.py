from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.engine import Connection

from app.config import settings
from app.database import SessionLocal
from app.models.portfolio import Holdings
from app.repositories.news_repository import NewsRepository
from app.scripts.seed_news import (
    BATCH_SIZE,
    BENCHMARK_TICKERS,
    DEFAULT_SINCE_DAYS,
    backfill_universe,
    detect_events,
    evidence_found,
    plan_calls,
)
from app.services import news_ingest
from app.services.risk_analytics import _closes
from app.services.ticker_map import listing_country
from app.utils.stock_cache import get_cached_price_histories, get_latest_close, is_stale

logger = logging.getLogger("news_nightly")
LOCK_ID = 3012026
DEFAULT_LOOKBACK_HOURS = 36
RECENT_TRADING_DAYS = 7
EXIT_CODES = {"ok": 0, "planned": 0, "dry_run": 0, "skipped": 0, "partial": 1, "failed": 2}
_SEVERITY = {"ok": 0, "dry_run": 0, "partial": 1, "failed": 2}


def try_lock(conn: Connection) -> bool:
    if conn.dialect.name != "postgresql":
        return True
    return bool(conn.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": LOCK_ID}).scalar())


def release_lock(conn: Connection) -> None:
    if conn.dialect.name == "postgresql":
        conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
    conn.close()


def ordered_universe(db) -> tuple[list[str], set[str]]:
    universe, held, _ = backfill_universe(db, [])
    return sorted(held) + [t for t in universe if t not in held], held


def refresh_prices(db, tickers: list[str]) -> tuple[dict, list[str]]:
    histories = get_cached_price_histories(tickers, period="1y", force_live=True)
    closes = {t: sorted(_closes(histories.get(t))) for t in tickers}
    failed = [t for t in tickers if is_stale(get_latest_close(t, db))]
    return closes, failed


def news_cursor(repo: NewsRepository, now: datetime) -> datetime:
    last = repo.last_run(("nightly",), ("ok", "partial"))
    if last is None or last.started_at is None:
        return now - timedelta(hours=DEFAULT_LOOKBACK_HOURS)
    started = last.started_at
    return started if started.tzinfo else started.replace(tzinfo=UTC)


def latest_news_calls(
    ordered: list[str], held: set[str], cursor: datetime, dry_run: bool
) -> list[news_ingest.PlannedCall]:
    after = cursor.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S")
    calls = []
    for group in (
        [t for t in ordered if t in held],
        [t for t in ordered if t not in held],
    ):
        for country in ("za", "us"):
            tickers = [t for t in group if listing_country(t) == country]
            for i in range(0, len(tickers), BATCH_SIZE):
                batch = tickers[i:i + BATCH_SIZE]
                scope = f"nightly:{','.join(batch)}"
                calls.append(news_ingest.PlannedCall(
                    scope=f"dry_run:{scope}" if dry_run else scope,
                    symbols=batch, published_after=after, countries=country,
                ))
    return calls


def recent_events(events: list[dict], closes: dict) -> list[dict]:
    recent = []
    for event in events:
        series = closes[event["ticker"]]
        if len(series) >= RECENT_TRADING_DAYS and event["date"] >= series[-RECENT_TRADING_DAYS][0]:
            recent.append(event)
    return recent


def uncovered(repo: NewsRepository, events: list[dict], names: dict[str, str]) -> list[dict]:
    found = evidence_found(repo, events, names)
    return [e for e in events if (e["ticker"], e["date"]) not in found]


def _summary(run, prices_failed: list[str], price_count: int, repo: NewsRepository,
             catchup: dict) -> dict:
    return {
        "run_id": str(run.id),
        "mode": run.mode,
        "status": run.status,
        "requests_made": run.requests_made,
        "articles_received": run.articles_received,
        "articles_new": run.articles_new,
        "articles_duplicate": run.articles_duplicate,
        "articles_malformed": run.articles_malformed,
        "links_new": run.links_new,
        "links_rejected": run.links_rejected,
        "events_considered": run.events_considered,
        "events_rejected_data": run.events_rejected_data,
        "events_with_candidates": run.events_with_candidates,
        "prices_current": price_count - len(prices_failed),
        "prices_failed": len(prices_failed),
        "budget_left": settings.news_daily_request_budget - news_ingest.calls_used_today(repo),
        "catchup_windows": catchup["ran"],
        "catchup_remaining": catchup["remaining"],
    }


def nightly(mode: str = "run") -> dict:
    db = SessionLocal()
    lock = db.get_bind().engine.connect()
    try:
        if not try_lock(lock):
            logger.warning("another run in progress")
            return {"status": "skipped", "reason": "another run in progress"}

        repo = NewsRepository(db)
        started = datetime.now(UTC)
        write = mode == "run"

        ordered, held = ordered_universe(db)
        names = {
            (t or "").upper(): n or ""
            for t, n in db.execute(select(Holdings.ticker, Holdings.instrument_name))
        }
        price_tickers = ordered + sorted(BENCHMARK_TICKERS - set(ordered))
        closes, prices_failed = refresh_prices(db, price_tickers)
        if prices_failed:
            logger.warning("no current price after refresh: %s", ", ".join(prices_failed))

        room = max(0, min(
            settings.news_nightly_request_budget,
            settings.news_daily_request_budget - news_ingest.calls_used_today(repo),
        ))
        planned_latest = latest_news_calls(ordered, held, news_cursor(repo, started),
                                           dry_run=(mode == "dry_run"))
        latest = planned_latest[:room]

        scanned: dict[str, list[str]] = {}
        events = detect_events({t: closes[t] for t in ordered if closes.get(t)}, held, scanned)
        recent = recent_events(events, closes)
        older = [e for e in events if e not in recent]
        rejected = [e for e in recent if e["rejected"]]

        run = news_ingest.start_run(db, "nightly", status="planned" if mode == "plan" else "failed")
        run.events_considered = len(recent)
        run.events_rejected_data = len(rejected)
        if mode != "plan":
            repo.upsert_anomalies(events, run.id)
        db.commit()
        details = {
            "prices_failed": prices_failed,
            "latest_batches": len(latest),
            "latest_batches_over_budget": len(planned_latest) - len(latest),
        }

        if mode == "plan":
            windows, skipped = plan_calls(repo, uncovered(repo, recent, names),
                                          budget=room - len(latest))
            backlog, backlog_skipped = plan_calls(
                repo, older, budget=room - len(latest) - len(windows),
                since_days=DEFAULT_SINCE_DAYS,
            )
            for call in latest + [c for _, c in windows] + [c for _, c in backlog]:
                logger.info("  %s %s after %s", call.scope, ",".join(call.symbols),
                            call.published_after)
            news_ingest.finish_run(db, run, "planned", details={
                **details, "event_windows": [c.scope for _, c in windows], "skipped": skipped,
                "catchup": [c.scope for _, c in backlog], "catchup_skipped": backlog_skipped,
            })
            catchup = {"ran": len(backlog), "remaining": backlog_skipped["over_budget"]}
            return _summary(run, prices_failed, len(price_tickers), repo, catchup)

        run_budget = min(settings.news_daily_request_budget,
                         news_ingest.calls_used_today(repo) + room)
        news_ingest.run_calls(db, run, latest, "nightly", write=write, budget=run_budget)
        stages = [(run.status, run.error_summary)]
        details["latest"] = json.loads(run.details or "{}")
        
        if run.status != "failed" and run.error_summary is None:
            windows, skipped = plan_calls(repo, uncovered(repo, recent, names),
                                          budget=room - run.requests_made,
                                          dry_run=(mode == "dry_run"))
            outcomes = news_ingest.run_calls(db, run, [c for _, c in windows], "nightly",
                                             write=write, budget=run_budget)
            stages.append((run.status, run.error_summary))
            run.events_with_candidates = sum(
                1 for o in outcomes
                if any(t["ticker"] in o["call"].symbols
                       for row in o["rows"] for t in row["tickers"])
            )
            details["event_windows"] = json.loads(run.details or "{}")
            details["event_windows_skipped"] = skipped

        backlog, backlog_skipped = plan_calls(repo, older, budget=room - run.requests_made,
                                              dry_run=(mode == "dry_run"),
                                              since_days=DEFAULT_SINCE_DAYS)
        answered = []
        if run.status != "failed" and run.error_summary is None:
            answered = news_ingest.run_calls(db, run, [c for _, c in backlog], "backfill",
                                             write=write, budget=run_budget)
            stages.append((run.status, run.error_summary))
            details["catchup"] = json.loads(run.details or "{}")
        details["catchup_skipped"] = backlog_skipped
        catchup = {
            "ran": len(answered),
            "remaining": backlog_skipped["over_budget"] + len(backlog) - len(answered),
        }
        logger.info("catch-up windows run %s, remaining %s", catchup["ran"], catchup["remaining"])

        details["scanned"] = scanned
        status = max((status for status, _ in stages), key=lambda s: _SEVERITY.get(s, 0))
        error = next((error for _, error in stages if error is not None), None)
        news_ingest.finish_run(db, run, status, error, details)
        return _summary(run, prices_failed, len(price_tickers), repo, catchup)
    finally:
        release_lock(lock)
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh prices and collect the day's news.")
    parser.add_argument("--plan", action="store_true", help="no news calls, just what would run")
    parser.add_argument("--dry-run", action="store_true", help="call and validate, store nothing")
    parser.add_argument("--quiet", action="store_true", help="warnings and the summary only")
    args = parser.parse_args(argv)
    if args.plan and args.dry_run:
        parser.error("choose one of --plan and --dry-run")

    level = logging.WARNING if args.quiet else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s %(name)s %(message)s")
    logger.setLevel(level)

    try:
        summary = nightly("plan" if args.plan else "dry_run" if args.dry_run else "run")
    except Exception as exc:
        logger.exception("nightly news run failed")
        summary = {"status": "failed", "error": f"{type(exc).__name__}: {exc}"}
    return EXIT_CODES.get(summary["status"], 2)


if __name__ == "__main__":
    sys.exit(main())