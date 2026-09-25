from __future__ import annotations

import json
import logging
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime

import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models.news_event import NewsIngestRun
from app.repositories.news_repository import NewsRepository
from app.services.ticker_map import listing_country

logger = logging.getLogger(__name__)

MARKETAUX_NEWS_URL = "https://api.marketaux.com/v1/news/all"
MARKETAUX_ENTITY_URL = "https://api.marketaux.com/v1/entity/search"
SOURCE = "marketaux"

ARTICLES_PER_REQUEST = 3
ON_DEMAND_TIMEOUT_SECONDS = 6
JOB_TIMEOUT_SECONDS = 15

RATE_LIMIT_PAUSE_SECONDS = 60
RETRY_PAUSE_SECONDS = 5
CALL_PAUSE_SECONDS = 1
MAX_CONSECUTIVE_FAILURES = 3
MAX_HIGHLIGHT_CHARS = 300

_STATUS_BY_HTTP = {
    401: "auth_error",
    402: "quota_exhausted",
    403: "auth_error",
    429: "rate_limited",
}
_STATUS_BY_ERROR_CODE = {
    "invalid_api_token": "auth_error",
    "endpoint_access_restricted": "auth_error",
    "usage_limit_reached": "quota_exhausted",
    "rate_limit_reached": "rate_limited",
}

_TAG = re.compile(r"<[^>]+>")
_TRUNCATED = re.compile(r"\s*\[\+\d+ characters\]\s*$")


@dataclass
class ProviderResult:
    status: str
    http_status: int | None = None
    articles: list[dict] = field(default_factory=list)
    error_code: str | None = None

    @property
    def ok(self) -> bool:
        return self.status in ("ok", "empty")


@dataclass
class PlannedCall:
    scope: str
    symbols: list[str]
    published_after: str | None = None
    published_before: str | None = None
    countries: str | None = None


def _read_response(response: requests.Response) -> ProviderResult:
    http_status = response.status_code
    try:
        payload = response.json()
    except ValueError:
        payload = None

    error = payload.get("error") if isinstance(payload, dict) else None
    error_code = error.get("code") if isinstance(error, dict) else None
    status = _STATUS_BY_HTTP.get(http_status) or _STATUS_BY_ERROR_CODE.get(error_code or "")
    if status:
        return ProviderResult(status, http_status, error_code=error_code)
    if http_status >= 500:
        return ProviderResult("provider_error", http_status, error_code=error_code)

    data = payload.get("data") if isinstance(payload, dict) else None
    if error or not isinstance(data, list):
        return ProviderResult("malformed", http_status, error_code=error_code)
    return ProviderResult("ok" if data else "empty", http_status, data)


def _get(url: str, params: dict, timeout: int) -> ProviderResult:
    try:
        response = requests.get(url, params=params, timeout=timeout)
    except requests.Timeout:
        return ProviderResult("provider_error", error_code="timeout")
    except requests.RequestException as exc:
        logger.warning("marketaux request failed: %s", exc)
        return ProviderResult("provider_error", error_code="connection")
    return _read_response(response)


def fetch_articles(
    symbols: list[str],
    timeout: int,
    published_after: str | None = None,
    published_before: str | None = None,
    countries: str | None = None,
) -> ProviderResult:
    params = {
        "api_token": settings.market_api_key,
        "symbols": ",".join(symbols),
        "filter_entities": "true",
        "language": "en",
        "limit": ARTICLES_PER_REQUEST,
    }
    if countries:
        params["countries"] = countries
    if published_after:
        params["published_after"] = published_after
    if published_before:
        params["published_before"] = published_before
    return _get(MARKETAUX_NEWS_URL, params, timeout)


def search_entities(symbols: list[str], timeout: int = JOB_TIMEOUT_SECONDS) -> ProviderResult:
    params = {"api_token": settings.market_api_key, "symbols": ",".join(symbols)}
    return _get(MARKETAUX_ENTITY_URL, params, timeout)


def parse_published(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _sentiment_label(score: float | None) -> str:
    if score is not None and score > 0:
        return "positive"
    if score is not None and score < 0:
        return "negative"
    return "neutral"


def clean_highlight(highlights: list[dict] | None) -> str | None:
    marked = next(
        (h.get("highlight") for h in highlights or [] if "<em>" in (h.get("highlight") or "")),
        None,
    )
    if not marked:
        return None
    text = _TRUNCATED.sub("", _TAG.sub("", marked)).strip()
    return text[:MAX_HIGHLIGHT_CHARS] or None


def link_entity(entity: dict, wanted: set[str]) -> tuple[str | None, str | None]:
    symbol = (entity.get("symbol") or "").upper()
    if symbol not in wanted:
        return None, "symbol_mismatch"
    if (entity.get("country") or "").lower() != listing_country(symbol):
        return None, "country_mismatch"
    if entity.get("type") != "equity":
        return None, "not_equity"
    return symbol, None


def normalise_article(article: dict, wanted: set[str]) -> dict | None:
    published = parse_published(article.get("published_at"))
    if not article.get("uuid") or not article.get("title") or published is None:
        return None

    links: dict[str, dict] = {}
    rejected = []
    for entity in article.get("entities") or []:
        ticker, reason = link_entity(entity, wanted)
        if reason:
            rejected.append({
                "symbol": entity.get("symbol"),
                "name": entity.get("name"),
                "country": entity.get("country"),
                "reason": reason,
            })
            continue
        if ticker and ticker not in links:
            links[ticker] = {
                "ticker": ticker,
                "name": entity.get("name"),
                "sentiment_score": entity.get("sentiment_score"),
                "match_score": entity.get("match_score"),
                "highlight": clean_highlight(entity.get("highlights")),
                "entity_country": (entity.get("country") or "").lower() or None,
            }

    lead = next(iter(links.values()), {}).get("sentiment_score")
    return {
        "external_id": article["uuid"],
        "source": SOURCE,
        "title": article["title"],
        "description": article.get("description"),
        "url": article.get("url"),
        "image_url": article.get("image_url"),
        "source_name": article.get("source"),
        "published_at": published,
        "sentiment": _sentiment_label(lead),
        "sentiment_score": lead,
        "tickers": list(links.values()),
        "rejected": rejected,
    }


def record_call(repo: NewsRepository, scope: str, result: ProviderResult) -> None:
    repo.record_fetch(scope, SOURCE, len(result.articles), ok=result.ok)


def _start_of_day_utc() -> datetime:
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def calls_used_today(repo: NewsRepository) -> int:
    return repo.calls_since(SOURCE, _start_of_day_utc())


def start_run(db: Session, mode: str, status: str = "failed") -> NewsIngestRun:
    run = NewsIngestRun(mode=mode, status=status)
    db.add(run)
    db.commit()
    return run


def finish_run(
    db: Session, run: NewsIngestRun, status: str, error: str | None = None,
    details: dict | None = None,
) -> None:
    run.status = status
    run.error_summary = error
    run.details = json.dumps(details or {}, default=str)
    run.finished_at = datetime.now(UTC)
    db.commit()


def _attempt(db: Session, repo: NewsRepository, run: NewsIngestRun, call: PlannedCall,
             budget: int) -> ProviderResult | None:
    if calls_used_today(repo) >= budget:
        return None
    result = fetch_articles(
        call.symbols, JOB_TIMEOUT_SECONDS, call.published_after, call.published_before,
        call.countries,
    )
    record_call(repo, call.scope, result)
    run.requests_made += 1
    db.commit()
    if not result.ok:
        logger.info(
            "%s %s %s..%s http=%s status=%s received=0 new=0 duplicate=0 rejected=0",
            call.scope, ",".join(call.symbols), call.published_after or "-",
            call.published_before or "-", result.http_status, result.status,
        )
    return result


def run_calls(
    db: Session,
    run: NewsIngestRun,
    calls: list[PlannedCall],
    ingest_mode: str,
    write: bool = True,
    budget: int | None = None,
) -> list[dict]:
    repo = NewsRepository(db)
    budget = settings.news_daily_request_budget if budget is None else budget
    reasons: Counter = Counter()
    per_ticker: dict[str, dict] = {}
    outcomes: list[dict] = []
    status, error = "ok", None
    failures = 0

    try:
        for i, call in enumerate(calls):
            if i:
                time.sleep(CALL_PAUSE_SECONDS)

            result = _attempt(db, repo, run, call, budget)
            if result is not None and result.status == "rate_limited":
                time.sleep(RATE_LIMIT_PAUSE_SECONDS)
                result = _attempt(db, repo, run, call, budget)
            elif result is not None and result.status == "provider_error":
                time.sleep(RETRY_PAUSE_SECONDS)
                result = _attempt(db, repo, run, call, budget)

            if result is None:
                status, error = "partial", f"daily budget of {budget} requests reached"
                break
            if result.status == "quota_exhausted":
                status, error = "partial", "marketaux usage limit reached (402)"
                break
            if result.status == "rate_limited":
                status, error = "partial", "still rate limited after one retry (429)"
                break
            if result.status == "auth_error":
                status, error = "failed", f"marketaux refused the key ({result.http_status})"
                break
            if result.status == "provider_error":
                failures += 1
                reasons["provider_error"] += 1
                if failures >= MAX_CONSECUTIVE_FAILURES:
                    status, error = "partial", f"{failures} failures in a row"
                    break
                continue

            failures = 0
            if result.status == "malformed":
                reasons["malformed_response"] += 1
                continue

            outcomes.append(_store(db, repo, run, call, result, ingest_mode, write, reasons,
                                   per_ticker))
    except Exception as exc:
        db.rollback()
        logger.exception("news ingest run %s stopped", run.id)
        status, error = "failed", f"{type(exc).__name__}: {exc}"

    if status == "ok" and (reasons["provider_error"] or reasons["malformed_response"]):
        status = "partial"
    if not write and status != "failed":
        status = "dry_run"
    finish_run(db, run, status, error, {"reasons": dict(reasons), "per_ticker": per_ticker})
    return outcomes


def _store(
    db: Session,
    repo: NewsRepository,
    run: NewsIngestRun,
    call: PlannedCall,
    result: ProviderResult,
    ingest_mode: str,
    write: bool,
    reasons: Counter,
    per_ticker: dict[str, dict],
) -> dict:
    wanted = {s.upper() for s in call.symbols}
    rows = []
    for article in result.articles:
        row = normalise_article(article, wanted)
        if row is None:
            run.articles_malformed += 1
            continue
        rows.append(row)
        for rejection in row["rejected"]:
            reasons[rejection["reason"]] += 1
        run.links_rejected += len(row["rejected"])
    run.articles_received += len(result.articles)

    new = links = 0
    if write and rows:
        new, links = repo.upsert_articles(rows, ingest_mode=ingest_mode, run_id=run.id)
        run.articles_new += new
        run.articles_duplicate += len(rows) - new
        run.links_new += links
    db.commit()

    for ticker in wanted:
        entry = per_ticker.setdefault(ticker, {"received": 0, "linked": 0})
        entry["received"] += len(result.articles)
        entry["linked"] += sum(1 for r in rows for t in r["tickers"] if t["ticker"] == ticker)

    logger.info(
        "%s %s %s..%s http=%s received=%s new=%s duplicate=%s rejected=%s",
        call.scope, ",".join(call.symbols), call.published_after or "-",
        call.published_before or "-", result.http_status, len(result.articles), new,
        len(rows) - new if write else 0, sum(len(r["rejected"]) for r in rows),
    )
    return {"call": call, "result": result, "rows": rows}