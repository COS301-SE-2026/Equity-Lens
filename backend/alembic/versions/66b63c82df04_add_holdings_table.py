"""add holdings table

Revision ID: 66b63c82df04
Revises: 
Create Date: 2026-06-21 15:23:34.782985

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '66b63c82df04'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'holdings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('ticker', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sector', sa.String(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('avg_price', sa.Float(), nullable=False),
        sa.Column('purchase_date', sa.DateTime(), nullable=True),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('source', sa.Enum('manual', 'csv', 'pdf', name='holdingsource'), nullable=False),
        sa.Column('broker', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_holdings_ticker'), 'holdings', ['ticker'], unique=False)
    op.create_index(op.f('ix_holdings_user_id'), 'holdings', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_holdings_user_id'), table_name='holdings')
    op.drop_index(op.f('ix_holdings_ticker'), table_name='holdings')
    op.drop_table('holdings')
    op.execute('DROP TYPE IF EXISTS holdingsource')
