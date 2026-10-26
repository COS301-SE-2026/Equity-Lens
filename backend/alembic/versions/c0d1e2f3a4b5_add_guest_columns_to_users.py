"""add guest columns to users

Revision ID: c0d1e2f3a4b5
Revises: f40d828e59ba
"""
from alembic import op
import sqlalchemy as sa

revision = "c0d1e2f3a4b5"
down_revision = "f40d828e59ba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_guest", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.add_column(
        "users", sa.Column("guest_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index("ix_users_guest_expires_at", "users", ["guest_expires_at"])


def downgrade() -> None:
    op.drop_index("ix_users_guest_expires_at", table_name="users")
    op.drop_column("users", "guest_expires_at")
    op.drop_column("users", "is_guest")
