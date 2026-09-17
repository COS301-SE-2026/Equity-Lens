from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.news_event import NewsArticle, NewsArticleTicker, NewsFetchLog
from app.services.ticker_map import canonical_key


class NewsRepository:
    def __init__(self, db: Session):
        self.db = db

    def _insert(self):
        return sqlite_insert if self.db.get_bind().dialect.name == "sqlite" else postgres_insert

    def upsert_articles(self, articles: list[dict]) -> int:
        rows = [a for a in articles if a.get("external_id") and a.get("title")]
        if not rows:
            return 0

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
            }
            for row in rows
        ])
        inserted = self.db.execute(
            stmt.on_conflict_do_nothing(index_elements=["external_id"])
        ).rowcount

        self._link_tickers(rows)
        return max(int(inserted), 0)

    def _link_tickers(self, rows: list[dict]) -> None:
        wanted = {row["external_id"]: row for row in rows if row.get("tickers")}
        if not wanted:
            return

        ids = self.db.execute(
            select(NewsArticle.id, NewsArticle.external_id)
            .where(NewsArticle.external_id.in_(wanted))
        ).all()

        links = [
            {
                "article_id": article_id,
                "ticker": canonical_key(entry["ticker"]),
                "sentiment_score": entry.get("sentiment_score"),
            }
            for article_id, external_id in ids
            for entry in wanted[external_id]["tickers"]
            if entry.get("ticker")
        ]
        if not links:
            return

        insert = self._insert()
        self.db.execute(
            insert(NewsArticleTicker).values(links)
            .on_conflict_do_nothing(index_elements=["article_id", "ticker"])
        )

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
                NewsArticle.published_at >= start,
                NewsArticle.published_at <= end,
            )
            .order_by(NewsArticle.published_at.desc())
            .distinct()
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def linked_article_dates(
        self, tickers: list[str], start: datetime, end: datetime
    ) -> dict[str, list[date]]:
        if not tickers:
            return {}

        stmt = (
            select(NewsArticleTicker.ticker, NewsArticle.published_at)
            .join(NewsArticle, NewsArticle.id == NewsArticleTicker.article_id)
            .where(
                NewsArticleTicker.ticker.in_([canonical_key(t) for t in tickers]),
                NewsArticle.published_at >= start,
                NewsArticle.published_at <= end,
            )
        )

        dates: dict[str, list[date]] = {}
        for ticker, published_at in self.db.execute(stmt):
            dates.setdefault(ticker, []).append(published_at.date())
        return dates

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

    def record_fetch(self, scope: str, source: str, article_count: int, ok: bool) -> None:
        self.db.add(NewsFetchLog(
            scope=scope,
            source=source,
            article_count=article_count,
            ok=ok,
            fetched_at=datetime.now(UTC),
        ))
