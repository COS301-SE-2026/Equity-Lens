from typing import Sequence, Union

from alembic import op


revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE portfolios SET account_type = lower(trim(account_type)) "
               "WHERE account_type IS NOT NULL")
    op.execute("UPDATE portfolios SET account_type = 'zar' "
               "WHERE account_type IS NOT NULL AND account_type NOT IN ('zar', 'tfsa', 'usd')")
    op.execute("UPDATE portfolios SET currency = CASE WHEN account_type = 'usd' THEN 'USD' "
               "ELSE 'ZAR' END WHERE account_type IS NOT NULL")


def downgrade() -> None:
    pass
