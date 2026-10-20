"""add guest columns to users

Revision ID: c0d1e2f3a4b5
Revises: b8c9d0e1f2a3
"""
from alembic import op
import sqlalchemy as sa

revision = "c0d1e2f3a4b5"
down_revision = "b8c9d0e1f2a3"
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
