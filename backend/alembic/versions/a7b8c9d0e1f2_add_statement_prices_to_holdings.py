from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('holdings', sa.Column('statement_price', sa.Numeric(18, 2), nullable=True))
    op.add_column('holdings', sa.Column('statement_value', sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('holdings', 'statement_value')
    op.drop_column('holdings', 'statement_price')
