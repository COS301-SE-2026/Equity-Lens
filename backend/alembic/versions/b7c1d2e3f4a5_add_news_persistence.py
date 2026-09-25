from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c1d2e3f4a5"
# originally a7b8c9d0e1f2. dev added eb52067672a7 (chat memory) on the same parent, and two
# heads stop `alembic upgrade head` from running, so the news chain now follows it. production
# is still at a7b8c9d0e1f2 and applies all of them in order.
down_revision: Union[str, None] = "eb52067672a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.create_table(
        "news_articles",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("external_id", sa.String(length=200), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("source_name", sa.String(length=120), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sentiment", sa.String(length=10), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id", name="uq_news_articles_external_id"),
    )
    op.create_index("ix_news_articles_published_at", "news_articles", ["published_at"])

    op.create_table(
        "news_article_tickers",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("article_id", sa.UUID(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["article_id"], ["news_articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article_id", "ticker", name="uq_news_article_ticker"),
    )
    op.create_index("ix_news_article_tickers_ticker", "news_article_tickers", ["ticker"])

    op.create_table(
        "news_fetch_log",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("scope", sa.String(length=120), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("article_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"),
                  nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_fetch_log_scope_fetched", "news_fetch_log", ["scope", "fetched_at"])


def downgrade() -> None:
    op.drop_index("ix_news_fetch_log_scope_fetched", table_name="news_fetch_log")
    op.drop_table("news_fetch_log")
    op.drop_index("ix_news_article_tickers_ticker", table_name="news_article_tickers")
    op.drop_table("news_article_tickers")
    op.drop_index("ix_news_articles_published_at", table_name="news_articles")
    op.drop_table("news_articles")
