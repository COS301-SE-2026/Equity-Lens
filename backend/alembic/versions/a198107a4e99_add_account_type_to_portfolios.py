"""add account type to portfolios

Revision ID: a198107a4e99
Revises: 3dfe71b5d9d7
Create Date: 2026-08-14 17:53:07.906559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a198107a4e99'
down_revision: Union[str, None] = '3dfe71b5d9d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('portfolios', sa.Column('account_type', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('portfolios', 'account_type')
