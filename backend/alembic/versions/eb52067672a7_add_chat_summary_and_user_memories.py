"""add chat summary and user memories

Revision ID: eb52067672a7
Revises: a7b8c9d0e1f2
Create Date: 2026-09-18 20:48:36.739705

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'eb52067672a7'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_conversations', sa.Column('summary', sa.Text(), nullable = True))
    op.add_column('chat_conversations', sa.Column('summarised', sa.DateTime(), nullable = True))

    op.create_table(
        'user_memories',
        sa.Column('id', UUID(as_uuid = True), nullable = False),
        sa.Column('user_id', UUID(as_uuid = True), nullable = False),
        sa.Column('fact', sa.String(length = 300), nullable = False),
        sa.Column('created_at', sa.DateTime(), nullable = True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete = 'CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_memories_user_id', 'user_memories', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_memories_user_id', table_name = 'user_memories')
    op.drop_table('user_memories')
    op.drop_column('chat_conversations', 'summarised')
    op.drop_column('chat_conversations', 'summary')

