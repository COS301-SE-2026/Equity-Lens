"""add market_data and fundamentals_cache tables

Revision ID: 3dfe71b5d9d7
Revises: d3e4f5a6b7c8
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3dfe71b5d9d7"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_data",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("high", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("low", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("close", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("prev_close", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("volume", sa.Integer(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_market_data_ticker", "market_data", ["ticker"])
    op.create_index("ix_market_data_date", "market_data", ["date"])
    op.create_index("ix_market_data_ticker_date", "market_data", ["ticker", "date"], unique=True)

    op.create_table(
        "fundamentals_cache",
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column("info", sa.JSON(), nullable=True),
        sa.Column("balance_sheet", sa.JSON(), nullable=True),
        sa.Column("financials", sa.JSON(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("ticker"),
    )


def downgrade() -> None:
    op.drop_table("fundamentals_cache")
    op.drop_index("ix_market_data_ticker_date", table_name="market_data")
    op.drop_index("ix_market_data_date", table_name="market_data")
    op.drop_index("ix_market_data_ticker", table_name="market_data")
    op.drop_table("market_data")
