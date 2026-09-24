import json
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.news_event import (
    NewsArticle,
    NewsArticleTicker,
    NewsFetchLog,
    NewsIngestRun,
    PriceAnomaly,
)
from app.services.ticker_map import canonical_key


class NewsRepository:
    def __init__(self, db: Session):
        self.db = db

    def _insert(self):
        return sqlite_insert if self.db.get_bind().dialect.name == "sqlite" else postgres_insert

    def upsert_articles(
        self, articles: list[dict], ingest_mode: str | None = None, run_id=None
    ) -> tuple[int, int]:
        rows = [a for a in articles if a.get("external_id") and a.get("title")]
        if not rows:
            return 0, 0

        insert = self._insert()
        stmt = insert(NewsArticle).values([
            {
                "external_id": row["external_id"],
                "source": row.get("source") or "unknown",
                "title": row["title"],
                "description": row.get("description"),
                "url": row.get("url"),
                "image_url": row.get("image_url"),
                "source_name": row.get("source_name"),
                "published_at": row["published_at"],
                "sentiment": row.get("sentiment"),
                "sentiment_score": row.get("sentiment_score"),
                "ingest_mode": ingest_mode,
                "first_ingest_run_id": run_id,
            }
            for row in rows
        ])
        inserted = self.db.execute(
            stmt.on_conflict_do_nothing(index_elements=["external_id"])
        ).rowcount

        links = self._link_tickers(rows)
        return max(int(inserted), 0), links

    def _link_tickers(self, rows: list[dict]) -> int:
        wanted = {row["external_id"]: row for row in rows if row.get("tickers")}
        if not wanted:
            return 0

        ids = self.db.execute(
            select(NewsArticle.id, NewsArticle.external_id)
            .where(NewsArticle.external_id.in_(wanted))
        ).all()

        links = [
            {
                "article_id": article_id,
                "ticker": canonical_key(entry["ticker"]),
                "sentiment_score": entry.get("sentiment_score"),
                "match_score": entry.get("match_score"),
                "highlight": entry.get("highlight"),
                "entity_country": entry.get("entity_country"),
            }
            for article_id, external_id in ids
            for entry in wanted[external_id]["tickers"]
            if entry.get("ticker")
        ]
        if not links:
            return 0

        insert = self._insert()
        inserted = self.db.execute(
            insert(NewsArticleTicker).values(links)
            .on_conflict_do_nothing(index_elements=["article_id", "ticker"])
        ).rowcount
        return max(int(inserted), 0)

    def articles_for_tickers(self, tickers: list[str], limit: int = 50) -> list[NewsArticle]:
        if not tickers:
            return []

        stmt = (
            select(NewsArticle)
            .join(NewsArticleTicker, NewsArticleTicker.article_id == NewsArticle.id)
            .where(NewsArticleTicker.ticker.in_([canonical_key(t) for t in tickers]))
            .order_by(NewsArticle.published_at.desc())
            .distinct()
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def articles_in_window(
        self, ticker: str, start: datetime, end: datetime, limit: int = 40
    ) -> list[NewsArticle]:
        stmt = (
            select(NewsArticle)
            .join(NewsArticleTicker, NewsArticleTicker.article_id == NewsArticle.id)
            .where(
                NewsArticleTicker.ticker == canonical_key(ticker),
                NewsArticleTicker.match_score.isnot(None),
                NewsArticle.published_at >= start,
                NewsArticle.published_at <= end,
            )
            .order_by(NewsArticle.published_at.desc())
            .distinct()
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def linked_articles(
        self, tickers: list[str], start: datetime, end: datetime
    ) -> dict[str, list[dict]]:
        if not tickers:
            return {}

        stmt = (
            select(NewsArticleTicker.ticker, NewsArticleTicker.match_score, NewsArticle.published_at, NewsArticle.title,)
            .join(NewsArticle, NewsArticle.id == NewsArticleTicker.article_id)
            .where(
                NewsArticleTicker.ticker.in_([canonical_key(t) for t in tickers]),
                NewsArticleTicker.match_score.isnot(None),
                NewsArticle.published_at >= start,
                NewsArticle.published_at <= end,
            )
        )

        found: dict[str, list[dict]] = {}
        for ticker, match_score, published_at, title in self.db.execute(stmt):
            found.setdefault(ticker, []).append(
                {"published_at": published_at, "title": title, "match_score": match_score}
            )
        return found

    def corpus_for_idf(self, limit: int = 2000) -> list[str]:
        stmt = (
            select(NewsArticle.title, NewsArticle.description)
            .order_by(NewsArticle.published_at.desc())
            .limit(limit)
        )
        return [
            f"{title} {description or ''}".strip()
            for title, description in self.db.execute(stmt)
        ]

    def should_fetch(self, scope: str, floor_hours: int) -> bool:
        if floor_hours <= 0:
            return True

        cutoff = datetime.now(UTC) - timedelta(hours=floor_hours)
        stmt = (
            select(NewsFetchLog.id)
            .where(NewsFetchLog.scope == scope, NewsFetchLog.ok.is_(True),
                   NewsFetchLog.fetched_at >= cutoff)
            .limit(1)
        )
        return self.db.scalars(stmt).first() is None

    def calls_since(self, source: str, since: datetime) -> int:
        stmt = select(func.count(NewsFetchLog.id)).where(
            NewsFetchLog.source == source, NewsFetchLog.fetched_at >= since
        )
        return int(self.db.scalar(stmt) or 0)

    def fetched_ok(self, scope: str) -> bool:
        stmt = (
            select(NewsFetchLog.id)
            .where(NewsFetchLog.scope == scope, NewsFetchLog.ok.is_(True))
            .limit(1)
        )
        return self.db.scalars(stmt).first() is not None

    def last_run(self, modes: tuple[str, ...], statuses: tuple[str, ...]) -> NewsIngestRun | None:
        stmt = (
            select(NewsIngestRun)
            .where(NewsIngestRun.mode.in_(modes), NewsIngestRun.status.in_(statuses))
            .order_by(NewsIngestRun.started_at.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def upsert_anomalies(self, events: list[dict], run_id=None) -> int:
        if not events:
            return 0

        now = datetime.now(UTC)
        insert = self._insert()
        stmt = insert(PriceAnomaly).values([
            {
                "ticker": e["ticker"],
                "event_date": e["date"],
                "k_sigma": e["k_sigma"],
                "return_pct": e["return_pct"],
                "z_score": e["z_score"],
                "sigma": e["sigma"],
                "direction": e["direction"],
                "band": e["band"],
                "validation": e["rejected"] or "ok",
                "first_seen_at": now,
                "last_seen_at": now,
                "first_run_id": run_id,
            }
            for e in events
        ])
        # a re-sighting keeps when and by which run it was first seen, but takes the latest
        # scoring: a move on the last day of a series has no next day yet, so it cannot be
        # called a spike until the night after
        latest = ("return_pct", "z_score", "sigma", "direction", "band", "validation",
                  "last_seen_at")
        stmt = stmt.on_conflict_do_update(
            index_elements=["ticker", "event_date", "k_sigma"],
            set_={column: stmt.excluded[column] for column in latest},
        )
        return max(int(self.db.execute(stmt).rowcount), 0)

    def latest_scan(self) -> tuple[NewsIngestRun, dict[str, list[str]]] | None:
        """The newest run that recorded which tickers it scored, and over which dates."""
        stmt = (
            select(NewsIngestRun)
            .where(NewsIngestRun.details.contains('"scanned"'))
            .order_by(NewsIngestRun.started_at.desc())
            .limit(1)
        )
        run = self.db.scalars(stmt).first()
        if run is None:
            return None
        return run, json.loads(run.details).get("scanned") or {}

    def unusual_on(self, day: date, k_sigma: float, tickers: list[str],
                   seen_since: datetime) -> list[PriceAnomaly]:
        if not tickers:
            return []

        stmt = (
            select(PriceAnomaly)
            .where(
                PriceAnomaly.event_date == day,
                PriceAnomaly.k_sigma == k_sigma,
                PriceAnomaly.validation == "ok",
                PriceAnomaly.ticker.in_(tickers),
                PriceAnomaly.last_seen_at >= seen_since,
            )
            .order_by(func.abs(PriceAnomaly.z_score).desc())
        )
        return list(self.db.scalars(stmt).all())

    def record_fetch(self, scope: str, source: str, article_count: int, ok: bool) -> None:
        self.db.add(NewsFetchLog(
            scope=scope,
            source=source,
            article_count=article_count,
            ok=ok,
            fetched_at=datetime.now(UTC),
        ))
