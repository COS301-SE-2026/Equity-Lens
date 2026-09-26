from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "news_ingest_runs",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"),
                  nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("requests_made", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("articles_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("articles_new", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("articles_duplicate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("articles_malformed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("links_new", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("links_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("events_considered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("events_rejected_data", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("events_with_candidates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("news_articles", sa.Column("ingest_mode", sa.String(length=20), nullable=True))
    op.add_column("news_articles", sa.Column("first_ingest_run_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_news_articles_first_ingest_run", "news_articles", "news_ingest_runs",
        ["first_ingest_run_id"], ["id"], ondelete="SET NULL",
    )

    op.add_column("news_article_tickers", sa.Column("match_score", sa.Float(), nullable=True))
    op.add_column("news_article_tickers", sa.Column("highlight", sa.Text(), nullable=True))
    op.add_column(
        "news_article_tickers", sa.Column("entity_country", sa.String(length=4), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("news_article_tickers", "entity_country")
    op.drop_column("news_article_tickers", "highlight")
    op.drop_column("news_article_tickers", "match_score")
    op.drop_constraint("fk_news_articles_first_ingest_run", "news_articles", type_="foreignkey")
    op.drop_column("news_articles", "first_ingest_run_id")
    op.drop_column("news_articles", "ingest_mode")
    op.drop_table("news_ingest_runs")
