"""add currency to portfolios

Revision ID: d3e4f5a6b7c8
Revises: c9f1a2b3d4e5
Create Date: 2026-07-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c9f1a2b3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "portfolios",
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="ZAR"),
    )


def downgrade() -> None:
    op.drop_column("portfolios", "currency")
