"""add ai_daily_usage

Revision ID: f40d828e59ba
Revises: b8c9d0e1f2a3
Create Date: 2026-10-19 21:00:10.693741

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'f40d828e59ba'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_daily_usage",
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "day"),
    )


def downgrade() -> None:
    op.drop_table("ai_daily_usage")
