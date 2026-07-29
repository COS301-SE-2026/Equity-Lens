"""First Migration

Revision ID: 164879389cd7
Revises: 
Create Date: 2026-07-29 11:32:58.821868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '164879389cd7'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
