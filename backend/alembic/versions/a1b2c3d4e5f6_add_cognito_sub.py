"""add cognito fields to users

Revision ID: a1b2c3d4e5f6
Revises: 66b63c82df04
Create Date: 2026-06-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '66b63c82df04'
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.add_column('users', sa.Column('cognito_sub', sa.String(), nullable=True))
    op.create_index('ix_users_cognito_sub', 'users', ['cognito_sub'], unique=True)
    op.alter_column('users', 'hashed_password', nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'hashed_password', nullable=False)
    op.drop_index('ix_users_cognito_sub', table_name='users')
    op.drop_column('users', 'cognito_sub')