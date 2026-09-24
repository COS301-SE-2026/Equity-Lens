import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, relationship

from app.database import Base


class NewsArticle(Base):

    __tablename__ = "news_articles"
    __table_args__ = (
        UniqueConstraint("external_id", name="uq_news_articles_external_id"),
        Index("ix_news_articles_published_at", "published_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(200), nullable=False)
    source = Column(String(30), nullable=False)

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    source_name = Column(String(120), nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=False)
    sentiment = Column(String(10), nullable=True)
    sentiment_score = Column(Float, nullable=True)

    fetched_at = Column(DateTime, default=lambda: datetime.now(UTC))
    ingest_mode = Column(String(20), nullable=True)
    first_ingest_run_id = Column(
        UUID(as_uuid=True), ForeignKey("news_ingest_runs.id", ondelete="SET NULL"), nullable=True
    )

    tickers: Mapped[list["NewsArticleTicker"]] = relationship(
        "NewsArticleTicker", back_populates="article", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"NewsArticle(external_id={self.external_id!r}, title={self.title!r})"


class NewsArticleTicker(Base):
    __tablename__ = "news_article_tickers"
    __table_args__ = (
        UniqueConstraint("article_id", "ticker", name="uq_news_article_ticker"),
        Index("ix_news_article_tickers_ticker", "ticker"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(
        UUID(as_uuid=True), ForeignKey("news_articles.id", ondelete="CASCADE"), nullable=False
    )
    ticker = Column(String(20), nullable=False)
    sentiment_score = Column(Float, nullable=True)
    match_score = Column(Float, nullable=True)
    highlight = Column(Text, nullable=True)
    entity_country = Column(String(4), nullable=True)

    article: Mapped["NewsArticle"] = relationship("NewsArticle", back_populates="tickers")

    def __repr__(self):
        return f"NewsArticleTicker(ticker={self.ticker!r}, article_id={self.article_id!r})"


class NewsFetchLog(Base):
    __tablename__ = "news_fetch_log"
    __table_args__ = (Index("ix_news_fetch_log_scope_fetched", "scope", "fetched_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(120), nullable=False)
    source = Column(String(30), nullable=False)
    article_count = Column(Integer, nullable=False, default=0)
    ok = Column(Boolean, nullable=False, default=True)
    fetched_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(UTC))

    def __repr__(self):
        return f"NewsFetchLog(scope={self.scope!r}, fetched_at={self.fetched_at!r})"


class NewsIngestRun(Base):
    __tablename__ = "news_ingest_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mode = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(UTC))
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False)

    requests_made: Mapped[int] = Column(Integer, nullable=False, default=0)
    articles_received: Mapped[int] = Column(Integer, nullable=False, default=0)
    articles_new: Mapped[int] = Column(Integer, nullable=False, default=0)
    articles_duplicate: Mapped[int] = Column(Integer, nullable=False, default=0)
    articles_malformed: Mapped[int] = Column(Integer, nullable=False, default=0)
    links_new: Mapped[int] = Column(Integer, nullable=False, default=0)
    links_rejected: Mapped[int] = Column(Integer, nullable=False, default=0)
    events_considered: Mapped[int] = Column(Integer, nullable=False, default=0)
    events_rejected_data: Mapped[int] = Column(Integer, nullable=False, default=0)
    events_with_candidates: Mapped[int] = Column(Integer, nullable=False, default=0)

    error_summary = Column(Text, nullable=True)
    details = Column(Text, nullable=True)

    def __repr__(self):
        return f"NewsIngestRun(mode={self.mode!r}, status={self.status!r})"
