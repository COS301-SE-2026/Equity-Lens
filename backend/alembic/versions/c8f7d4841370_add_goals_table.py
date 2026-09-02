from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8f7d4841370"
down_revision: Union[str, None] = "a198107a4e99"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.create_table(
        "goals",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("goal_type", sa.String(length=30), nullable=False),
        sa.Column("target_value", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("target_age", sa.Integer(), nullable=True),
        sa.Column("current_age", sa.Integer(), nullable=True),
        sa.Column("target_years", sa.Integer(), nullable=True),
        sa.Column("monthly_contribution", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("expected_return_pct", sa.Numeric(precision=6, scale=3), nullable=True),
        sa.Column("volatility_pct", sa.Numeric(precision=6, scale=3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")
