from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "price_anomalies",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("k_sigma", sa.Float(), nullable=False),
        sa.Column("return_pct", sa.Float(), nullable=True),
        sa.Column("z_score", sa.Float(), nullable=True),
        sa.Column("sigma", sa.Float(), nullable=True),
        sa.Column("direction", sa.String(length=4), nullable=True),
        sa.Column("band", sa.String(length=20), nullable=True),
        sa.Column("validation", sa.String(length=12), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"),
                  nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"),
                  nullable=False),
        sa.Column("first_run_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["first_run_id"], ["news_ingest_runs.id"], ondelete="SET NULL",
                                name="fk_price_anomalies_first_run"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticker", "event_date", "k_sigma",
                            name="uq_price_anomalies_ticker_day_k"),
    )
    op.create_index("ix_price_anomalies_event_date", "price_anomalies", ["event_date"])


def downgrade() -> None:
    op.drop_index("ix_price_anomalies_event_date", table_name="price_anomalies")
    op.drop_table("price_anomalies")
