"""Fill news_articles from marketaux, ahead of time.

Why this exists: the event endpoints rank stored articles, and the BM25 IDF is computed over
whatever is in news_articles. On a cold database the ranking has nothing to work with, and the
first request of the day would have to go to a metered free tier to get it - during a demo,
over conference wifi, with a six-second timeout in the way.

Run it from backend/ (or `docker compose exec backend python -m app.scripts.seed_news ...`):

    python -m app.scripts.seed_news                       # held book + curated universe, latest
    python -m app.scripts.seed_news NPN.JO SBK.JO AGL.JO  # explicit tickers override the default
    python -m app.scripts.seed_news --backfill-days 120   # same set, over a rolling 120-day window
    python -m app.scripts.seed_news --event-windows --plan          # what a backfill would do
    python -m app.scripts.seed_news --event-windows --dry-run --budget 10
    python -m app.scripts.seed_news --event-windows --budget 40 --report review.md
    python -m app.scripts.seed_news --event-windows --plan --since-days 90
    python -m app.scripts.seed_news --quiet

--event-windows finds past moves the same way the chart does (score_series, same k), throws out
the ones that are bad data rather than real moves, and asks marketaux for the news around each
remaining date, one request per event. Every request is written to news_fetch_log, which is the
daily budget, and a window that already has a successful row there is not asked for again - so
the backfill can be run a little every day and picks up where it stopped. Only moves from the
last --since-days (six months by default) get a call; older ones are still detected and counted.
Every detected move, bad data included, is also kept in price_anomalies (except with --plan).

The free plan returns 3 articles a request and 100 requests a day, and JSE coverage is thin.
Plenty of real JSE moves will have no article at all, and the report says so rather than
filling the gap.

It is also run daily from cron, which is what --quiet and the exit code are for: a run that
harvested nothing has to be distinguishable from one that worked, in a log nobody reads until
something has already gone wrong.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import UTC, date, datetime, time, timedelta

import numpy as np
from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models.portfolio import Holdings
from app.repositories.news_repository import NewsRepository
from app.services import news_ingest
from app.services.event_detection import K_SIGMA, MAX_GAP_DAYS, band_for, score_series
from app.services.instruments import REGION_BENCHMARKS, looks_like_fund
from app.services.news_ranking import (
    MAX_DAYS_AFTER,
    MAX_DAYS_BEFORE,
    counts_as_evidence,
    local_date,
    named_in_headline,
    query_terms,
)
from app.services.risk_analytics import _closes
from app.services.ticker_map import listing_country
from app.utils.stock_cache import get_cached_price_histories

logger = logging.getLogger("seed_news")

# a short symbol list per call, so one ticker with no coverage cannot crowd the others out of the
# three articles a call returns
BATCH_SIZE = 5

# JSE Top 40 constituents plus the US mega-caps a SA retail investor most often holds offshore,
# in the app's own holding-ticker format (yfinance: .JO for the JSE, bare symbol for the US).
# hand-maintained from the JSE Top 40 index sheet - not fetched, so seed breadth never depends
# on a live index call or on what happens to be imported yet
SEED_UNIVERSE = [
    "NPN.JO", "PRX.JO", "BHG.JO", "AGL.JO", "FSR.JO", "SBK.JO", "CPI.JO", "MTN.JO",
    "GLN.JO", "ABG.JO", "NED.JO", "SLM.JO", "SOL.JO", "IMP.JO", "AMS.JO", "ANG.JO",
    "GFI.JO", "SHP.JO", "CFR.JO", "BID.JO", "BVT.JO", "VOD.JO", "APN.JO", "REM.JO",
    "DSY.JO", "INP.JO", "MRP.JO", "CLS.JO", "WHL.JO", "TFG.JO", "EXX.JO", "KIO.JO",
    "HAR.JO", "SSW.JO", "OMU.JO", "MCG.JO", "TBS.JO", "NRP.JO", "RNI.JO", "BTI.JO",
    # US mega-caps commonly held offshore via feeder ETFs or an offshore account
    "AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "TSLA", "JPM", "V", "KO",
]

# the link window is [-3, +1] days in exchange-local dates. in UTC that is reached by asking for
# 4 days before (a JSE article at 22:00 UTC is already the next day in Johannesburg) and 2 days
# after
WINDOW_DAYS_BEFORE = 4
WINDOW_DAYS_AFTER = 2
DEFAULT_BUDGET = 60
EVENT_HISTORY_PERIOD = "1y"
# the six months limits which moves get a news call, not the history they are found in. the
# detector seeds its variance from the first 30 returns it is given, so a six-month series would
# flag different days from the ones on the chart
DEFAULT_SINCE_DAYS = 183
ENTITY_SEARCH_BATCH = 50

# bad-data checks, run before any quota is spent on an event
UNIT_FLIP_TOLERANCE = 0.05
SPIKE_MOVE = 0.20
SPIKE_REVERSAL = 0.80

BENCHMARK_TICKERS = {ticker for ticker, _, _ in REGION_BENCHMARKS.values()}


def _merge_universe(held: list[str]) -> list[str]:
    #the held book plus the curated universe, deduped and format-preserving (both are upper)
    return sorted(set(held) | set(SEED_UNIVERSE))


def _held_tickers(db) -> list[str]:
    rows = db.query(Holdings.ticker).filter(
        Holdings.ticker.isnot(None), Holdings.ticker != "", Holdings.ticker != "None",
    ).distinct().all()
    return sorted({row[0].upper() for row in rows if row[0]})


def seed(tickers: list[str], published_after: str | None = None) -> bool:
    """False when the provider let us down, so the caller can exit non-zero."""
    db = SessionLocal()
    try:
        tickers = tickers or _merge_universe(_held_tickers(db))
        if not tickers:
            logger.warning("no tickers to seed - import a portfolio first, or pass them as args")
            return True

        calls = [
            news_ingest.PlannedCall(
                scope=f"nightly:{','.join(batch)}", symbols=batch, published_after=published_after,
            )
            for batch in (tickers[i:i + BATCH_SIZE] for i in range(0, len(tickers), BATCH_SIZE))
        ]
        run = news_ingest.start_run(db, "nightly")
        news_ingest.run_calls(db, run, calls, ingest_mode="nightly")
        if run.status != "ok":
            logger.error("marketaux call failed - run ended %s: %s", run.status, run.error_summary)
            return False

        logger.info("seeded %s new articles across %s tickers", run.articles_new, len(tickers))
        return True
    finally:
        db.close()


def backfill_universe(db, tickers: list[str]) -> tuple[list[str], set[str], list[dict]]:
    """(universe, held, excluded). Funds and region benchmarks are left out: their moves are
    the market's, and marketaux does not tag an ETF as the company it holds."""
    if tickers:
        return sorted(set(tickers)), set(tickers), []

    rows = db.execute(
        select(Holdings.ticker, Holdings.instrument_name).where(Holdings.ticker.isnot(None))
    ).all()
    held: set[str] = set()
    excluded: dict[str, str] = {}
    for ticker, name in rows:
        ticker = (ticker or "").strip().upper()
        if not ticker or ticker == "NONE":
            continue
        if ticker in BENCHMARK_TICKERS:
            excluded[ticker] = "region_benchmark"
        elif looks_like_fund(name or ""):
            excluded[ticker] = "fund"
        else:
            held.add(ticker)

    return (
        sorted(held | set(SEED_UNIVERSE)),
        held,
        [{"ticker": t, "reason": excluded[t]} for t in sorted(excluded)],
    )


def validate_event(series: list[tuple[date, float]], day: date) -> str | None:
    """Why this move is bad data rather than a move, or None if it looks real."""
    ordered = sorted((d, p) for d, p in series if p and p > 0)
    days = [d for d, _ in ordered]
    if day not in days:
        return "gap"
    i = days.index(day)
    if i == 0 or (day - days[i - 1]).days > MAX_GAP_DAYS:
        return "gap"

    before, price = ordered[i - 1][1], ordered[i][1]
    ratio = price / before
    # the cache has held JSE prices in cents on some days and rands on others. a real share
    # does not move by a factor of 100 overnight
    if abs(ratio / 100 - 1) <= UNIT_FLIP_TOLERANCE or abs(ratio * 100 - 1) <= UNIT_FLIP_TOLERANCE:
        return "unit_flip"

    # a big move that is almost entirely undone the next day is a bad print, not news
    if abs(ratio - 1) >= SPIKE_MOVE and i + 1 < len(ordered):
        after = ordered[i + 1][1]
        if (price - after) / (price - before) >= SPIKE_REVERSAL:
            return "spike"
    return None


def detect_events(
    closes_by_ticker: dict[str, list[tuple[date, float]]],
    held: set[str],
    scanned: dict[str, list[str]] | None = None,
) -> list[dict]:
    """Every move score_series flags. When `scanned` is given, it is filled with each scored
    ticker's first scored date and last date, which is what the register's same-day count needs
    to know what "we looked" covered."""
    events = []
    for ticker, series in closes_by_ticker.items():
        scored = score_series(series, k_sigma=K_SIGMA)
        if not scored["available"]:
            continue
        if scanned is not None:
            scanned[ticker] = [scored["first_scored_date"], scored["last_date"]]
        for event in scored["events"]:
            day = date.fromisoformat(event["date"])
            events.append({
                "ticker": ticker,
                "date": day,
                "return_pct": event["return_pct"],
                "z_score": event["z_score"],
                "sigma": event["sigma"],
                "direction": event["direction"],
                "band": band_for(event["z_score"]),
                "k_sigma": scored["k_sigma"],
                "held": ticker in held,
                "rejected": validate_event(series, day),
            })
    return events


def prioritise(events: list[dict]) -> list[dict]:
    # somebody's own holding before a universe-only one, then the more unusual move first
    return sorted(events, key=lambda e: (not e["held"], -abs(e["z_score"])))


def window_start(since_days: int, today: date | None = None) -> date:
    return (today or date.today()) - timedelta(days=since_days)


def plan_calls(
    repo: NewsRepository,
    events: list[dict],
    budget: int,
    dry_run: bool = False,
    since_days: int = DEFAULT_SINCE_DAYS,
    today: date | None = None,
) -> tuple[list[tuple[dict, news_ingest.PlannedCall]], dict]:
    remaining = min(budget, settings.news_daily_request_budget - news_ingest.calls_used_today(repo))
    oldest = window_start(since_days, today)
    planned: list[tuple[dict, news_ingest.PlannedCall]] = []
    skipped = {"older_than_window": 0, "already_fetched": 0, "over_budget": 0}

    for event in prioritise([e for e in events if not e["rejected"]]):
        ticker, day = event["ticker"], event["date"]
        # before the budget, so an old move never takes a call from a recent one
        if day < oldest:
            skipped["older_than_window"] += 1
            continue
        scope = f"backfill:{ticker}:{day.isoformat()}"
        # the ok ledger row from the call that already covered this window is the resume
        # marker - there is no second record of it
        if repo.fetched_ok(scope):
            skipped["already_fetched"] += 1
            continue
        if len(planned) >= remaining:
            skipped["over_budget"] += 1
            continue
        planned.append((event, news_ingest.PlannedCall(
            # a dry run's calls are real and count against the day, but they store nothing, so
            # they must not mark the window as done
            scope=f"dry_run:{ticker}:{day.isoformat()}" if dry_run else scope,
            symbols=[ticker],
            published_after=(day - timedelta(days=WINDOW_DAYS_BEFORE)).isoformat(),
            published_before=(day + timedelta(days=WINDOW_DAYS_AFTER)).isoformat(),
            countries=listing_country(ticker),
        )))
    return planned, skipped


def verify_universe(db, repo: NewsRepository, universe: list[str]) -> tuple[set[str], str | None]:
    """Tickers marketaux knows. On any failure, every ticker and the reason it went unchecked."""
    known: set[str] = set()
    for i in range(0, len(universe), ENTITY_SEARCH_BATCH):
        result = news_ingest.search_entities(universe[i:i + ENTITY_SEARCH_BATCH])
        news_ingest.record_call(repo, "backfill:universe", result)
        db.commit()
        if not result.ok:
            return set(universe), f"entity search {result.status} (http {result.http_status})"
        known |= {(e.get("symbol") or "").upper() for e in result.articles}
    return known, None


def _percentiles(scores: list[float]) -> str:
    if not scores:
        return "no linked entities seen"
    p10, p25, p50, p75, p90 = np.percentile(scores, [10, 25, 50, 75, 90])
    return (f"n={len(scores)} p10={p10:.1f} p25={p25:.1f} p50={p50:.1f} "
            f"p75={p75:.1f} p90={p90:.1f}")


def _cell(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ")


def evidence_found(repo: NewsRepository, events: list[dict],
                   names: dict[str, str]) -> set[tuple[str, date]]:
    """(ticker, date) of each event with a stored article that would show on its card."""
    if not events:
        return set()
    days = [e["date"] for e in events]
    # a day wider each side than the link window, which counts_as_evidence then applies exactly
    start = datetime.combine(min(days) - timedelta(days=MAX_DAYS_BEFORE + 1), time.min,
                             tzinfo=UTC)
    end = datetime.combine(max(days) + timedelta(days=MAX_DAYS_AFTER + 1), time.max, tzinfo=UTC)
    linked = repo.linked_articles(sorted({e["ticker"] for e in events}), start, end)

    found = set()
    for e in events:
        terms = query_terms(e["ticker"], names.get(e["ticker"], ""))
        if any(counts_as_evidence(a, e["ticker"], terms, e["date"])
               for a in linked.get(e["ticker"], [])):
            found.add((e["ticker"], e["date"]))
    return found


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def coverage_summary(events: list[dict], oldest: date, fetched: set[tuple[str, date]],
                     evidence: set[tuple[str, date]]) -> dict:
    """The report's headline numbers. Only moves on or after `oldest` count, and the
    percentage is over validated moves - bad data was never going to have news."""
    window = [e for e in events if e["date"] >= oldest]
    genuine = [e for e in window if not e["rejected"]]

    per_ticker = {}
    for ticker in sorted({e["ticker"] for e in window}):
        mine = [(ticker, e["date"]) for e in genuine if e["ticker"] == ticker]
        with_news = sum(1 for key in mine if key in evidence)
        per_ticker[ticker] = {
            "detected": sum(1 for e in window if e["ticker"] == ticker),
            "validated": len(mine),
            "fetched": sum(1 for key in mine if key in fetched),
            "with_evidence": with_news,
            "evidence_pct": _pct(with_news, len(mine)),
        }

    with_news = sum(1 for e in genuine if (e["ticker"], e["date"]) in evidence)
    return {
        "since": oldest,
        "detected": len(window),
        "up": sum(1 for e in window if e["direction"] == "up"),
        "down": sum(1 for e in window if e["direction"] == "down"),
        "bands": dict(Counter(e["band"] for e in window)),
        "validated": len(genuine),
        "rejected": dict(Counter(e["rejected"] for e in window if e["rejected"])),
        "fetched": sum(1 for e in genuine if (e["ticker"], e["date"]) in fetched),
        "with_evidence": with_news,
        "evidence_pct": _pct(with_news, len(genuine)),
        "per_ticker": per_ticker,
    }


def _coverage_lines(summary: dict) -> list[str]:
    pct = summary["evidence_pct"]
    rejected = summary["rejected"]
    lines = [
        f"## Coverage since {summary['since']}",
        "",
        f"- Anomalies detected: {summary['detected']} ({summary['up']} up, "
        f"{summary['down']} down). By band: "
        + (", ".join(f"{band} {n}" for band, n in sorted(summary["bands"].items())) or "none"),
        f"- Validated: {summary['validated']}. Rejected as bad data: "
        f"{sum(rejected.values())}"
        + (f" ({', '.join(f'{r} {n}' for r, n in sorted(rejected.items()))})" if rejected else ""),
        f"- News windows fetched: {summary['fetched']} of {summary['validated']}",
        f"- With at least one provider-tagged article in [-3, +1] days: "
        f"{summary['with_evidence']} of {summary['validated']}"
        + (f" ({pct:.1f}%)" if pct is not None else ""),
        "",
        "| Ticker | Detected | Validated | Fetched | With news | % |",
        "|---|---|---|---|---|---|",
    ]
    for ticker, row in summary["per_ticker"].items():
        share = "-" if row["evidence_pct"] is None else f"{row['evidence_pct']:.1f}"
        lines.append(f"| {ticker} | {row['detected']} | {row['validated']} | {row['fetched']} | "
                     f"{row['with_evidence']} | {share} |")
    lines.append("")
    return lines


def write_report(path: str, events: list[dict], outcomes: dict[tuple[str, date], dict],
                 summary: dict) -> None:
    lines = [
        "# News backfill review",
        "",
        "Articles listed here are candidates the provider tagged with the company and published "
        "around the date. They are not established causes of the move.",
        "",
        *_coverage_lines(summary),
        "| Ticker | Event date | Move % | z | Validation | Articles accepted | Entities rejected |",
        "|---|---|---|---|---|---|---|",
    ]
    for event in prioritise(events):
        ticker, day = event["ticker"], event["date"]
        outcome = outcomes.get((ticker, day))
        accepted, rejected = [], []
        for row in outcome["rows"] if outcome else []:
            for link in (t for t in row["tickers"] if t["ticker"] == ticker):
                local = local_date(row["published_at"], ticker)
                named = named_in_headline(row["title"], query_terms(ticker, link.get("name") or ""))
                accepted.append(
                    f"{_cell(row['title'])} - {_cell(row.get('source_name') or '?')}, {local} "
                    f"({(local - day).days:+d}d), headline {'names it' if named else 'does not'}, "
                    f"score {link.get('match_score')}"
                )
            rejected += [f"{r['symbol']} {r.get('country') or ''} {r['reason']}"
                         for r in row["rejected"]]

        if event["rejected"]:
            found = "not queried"
        elif outcome is None:
            found = "not queried (budget, already fetched or run stopped)"
        else:
            found = "<br>".join(accepted) or "none found"
        lines.append(
            f"| {ticker} | {day} | {event['return_pct']:+.2f} | {event['z_score']:+.2f} | "
            f"{event['rejected'] or 'ok'} | {found} | {'<br>'.join(rejected) or '-'} |"
        )

    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def backfill_event_windows(tickers: list[str], mode: str = "write", budget: int = DEFAULT_BUDGET,
                           report: str | None = None, since_days: int = DEFAULT_SINCE_DAYS,
                           today: date | None = None) -> bool:
    db = SessionLocal()
    try:
        repo = NewsRepository(db)
        universe, held, excluded = backfill_universe(db, tickers)

        unknown: list[str] = []
        if mode == "plan":
            known, unverified = verify_universe(db, repo, universe)
            if unverified:
                logger.warning("universe not verified against marketaux: %s", unverified)
            unknown = sorted(set(universe) - known)
            universe = [t for t in universe if t in known]

        histories = get_cached_price_histories(
            universe, period=EVENT_HISTORY_PERIOD, force_live=True
        )
        closes = {t: _closes(histories.get(t)) for t in universe}
        no_history = sorted(t for t, series in closes.items() if not series)

        scanned: dict[str, list[str]] = {}
        events = detect_events({t: s for t, s in closes.items() if s}, held, scanned)
        rejected = [e for e in events if e["rejected"]]
        planned, skipped = plan_calls(repo, events, budget, dry_run=(mode == "dry_run"),
                                      since_days=since_days, today=today)

        logger.info("universe %s tickers (%s held); excluded %s; unknown to marketaux %s",
                    len(universe), len(held & set(universe)),
                    ", ".join(f"{e['ticker']} ({e['reason']})" for e in excluded) or "none",
                    ", ".join(unknown) or "none")
        logger.info("no price history: %s", ", ".join(no_history) or "none")
        logger.info("events %s, rejected as bad data %s (%s)", len(events), len(rejected),
                    ", ".join(f"{r}={sum(1 for e in rejected if e['rejected'] == r)}"
                              for r in ("gap", "unit_flip", "spike")))
        logger.info("planned calls %s, older than %s days %s, already fetched %s, over budget %s; "
                    "used today %s of %s", len(planned), since_days, skipped["older_than_window"],
                    skipped["already_fetched"], skipped["over_budget"],
                    news_ingest.calls_used_today(repo), settings.news_daily_request_budget)
        for event, call in planned:
            logger.info("  %s %s z=%+.2f move=%+.2f%% %s..%s", event["ticker"], event["date"],
                        event["z_score"], event["return_pct"], call.published_after,
                        call.published_before)

        run = news_ingest.start_run(
            db, "backfill", status="planned" if mode == "plan" else "failed"
        )
        run.events_considered = len(events)
        run.events_rejected_data = len(rejected)
        if mode != "plan":
            # the register keeps what the detector returned, bad data included. no provider call
            repo.upsert_anomalies(events, run.id)
        db.commit()

        outcomes: dict[tuple[str, date], dict] = {}
        if mode == "plan":
            news_ingest.finish_run(db, run, "planned", details={
                "planned": [f"{e['ticker']}:{e['date']}" for e, _ in planned],
                "excluded": excluded, "unknown": unknown, "no_history": no_history,
                "skipped": skipped,
            })
        else:
            # the call budget for this run is --budget on top of what the day has already used,
            # and never more than the daily limit
            run_budget = min(settings.news_daily_request_budget,
                             news_ingest.calls_used_today(repo) + budget)
            results = news_ingest.run_calls(
                db, run, [call for _, call in planned], ingest_mode="backfill",
                write=(mode == "write"), budget=run_budget,
            )
            by_scope = {r["call"].scope: r for r in results}
            for event, call in planned:
                if call.scope in by_scope:
                    outcomes[(event["ticker"], event["date"])] = by_scope[call.scope]
            run.events_with_candidates = sum(
                1 for (ticker, _), outcome in outcomes.items()
                if any(t["ticker"] == ticker for row in outcome["rows"] for t in row["tickers"])
            )
            db.commit()

            scores = [t["match_score"] for o in outcomes.values() for row in o["rows"]
                      for t in row["tickers"] if t.get("match_score") is not None]
            logger.info("match scores of linked entities: %s", _percentiles(scores))
            logger.info("run %s: %s, requests %s, received %s, new %s, duplicate %s, "
                        "malformed %s, links new %s, rejected %s, events with candidates %s",
                        run.id, run.status, run.requests_made, run.articles_received,
                        run.articles_new, run.articles_duplicate, run.articles_malformed,
                        run.links_new, run.links_rejected, run.events_with_candidates)
            if mode == "dry_run":
                for (ticker, day), outcome in outcomes.items():
                    for row in outcome["rows"]:
                        for link in (t for t in row["tickers"] if t["ticker"] == ticker):
                            logger.info("  would store %s %s: %s (score %s)", ticker, day,
                                        row["title"], link.get("match_score"))

            # only a scan of the whole universe says what "the others" were on a given day. a
            # run over a few named tickers would make everything else look unscanned
            if not tickers:
                news_ingest.finish_run(db, run, run.status, run.error_summary, {
                    **json.loads(run.details or "{}"), "scanned": scanned,
                })

        oldest = window_start(since_days, today)
        in_window = [e for e in events if not e["rejected"] and e["date"] >= oldest]
        fetched = {(e["ticker"], e["date"]) for e in in_window
                   if repo.fetched_ok(f"backfill:{e['ticker']}:{e['date'].isoformat()}")}
        names = {
            (t or "").upper(): n or ""
            for t, n in db.execute(select(Holdings.ticker, Holdings.instrument_name))
        }
        # counted from stored articles, so a dry run's finds are not in it
        summary = coverage_summary(events, oldest, fetched, evidence_found(repo, in_window, names))
        logger.info("since %s: %s anomalies, %s validated, %s fetched, %s with news (%s%%)",
                    oldest, summary["detected"], summary["validated"], summary["fetched"],
                    summary["with_evidence"], summary["evidence_pct"])

        if report:
            write_report(report, events, outcomes, summary)
            logger.info("review report written to %s", report)
        return run.status in ("ok", "planned", "dry_run")
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fill news_articles from marketaux.")
    parser.add_argument(
        "tickers", nargs="*", help="tickers to seed; defaults to everything currently held",
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="log warnings and errors only, for cron",
    )
    parser.add_argument(
        "--backfill-days", type=int, default=None, metavar="N",
        help="seed over a rolling N-day window instead of just the latest",
    )
    parser.add_argument(
        "--event-windows", action="store_true",
        help="find past moves the way the chart does and fetch the news around each one",
    )
    parser.add_argument("--plan", action="store_true",
                        help="with --event-windows: no news calls, just what would be asked")
    parser.add_argument("--dry-run", action="store_true",
                        help="with --event-windows: call and validate, store nothing")
    parser.add_argument("--budget", type=int, default=DEFAULT_BUDGET, metavar="N",
                        help="with --event-windows: most requests this run may make")
    parser.add_argument("--report", metavar="PATH",
                        help="with --event-windows: write a markdown review table here")
    parser.add_argument("--since-days", type=int, default=DEFAULT_SINCE_DAYS, metavar="N",
                        help="with --event-windows: only moves from the last N days get a call")
    args = parser.parse_args(argv)
    if (args.plan or args.dry_run or args.report) and not args.event_windows:
        parser.error("--plan, --dry-run and --report only apply to --event-windows")
    if args.since_days < 1:
        parser.error("--since-days must be at least 1")
    if args.plan and args.dry_run:
        parser.error("choose one of --plan and --dry-run")

    # WARNING rather than silence: a cron log that stays empty on a good run but still says
    # "no tickers to seed" is the one worth keeping
    level = logging.WARNING if args.quiet else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s %(name)s %(message)s")
    # basicConfig does nothing at all once the root logger has a handler, and something in the
    # import chain only has to grow one for --quiet to stop working without saying so. setting
    # the level on this script's own logger is what actually decides what reaches the log
    logger.setLevel(level)

    tickers = [t.upper() for t in args.tickers]
    if args.event_windows:
        mode = "plan" if args.plan else "dry_run" if args.dry_run else "write"
        ok = backfill_event_windows(tickers, mode=mode, budget=args.budget, report=args.report,
                                    since_days=args.since_days)
    elif args.backfill_days is not None:
        after = (date.today() - timedelta(days=args.backfill_days)).isoformat()
        ok = seed(tickers, published_after=after)
    else:
        ok = seed(tickers)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
