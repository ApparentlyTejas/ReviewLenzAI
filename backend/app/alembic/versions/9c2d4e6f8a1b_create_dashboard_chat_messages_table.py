"""create dashboard_chat_messages table

Revision ID: 9c2d4e6f8a1b
Revises: 7a1b2c3d4e5f
Create Date: 2026-10-27 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9c2d4e6f8a1b'
down_revision: str | None = '7a1b2c3d4e5f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'dashboard_chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        # postgresql.ENUM(..., create_type=False): the chat_role enum type already
        # exists, created by the chat_messages migration (7a1b2c3d4e5f) — re-declaring
        # it via plain sa.Enum (even with create_type=False) still emits a CREATE TYPE
        # for op.create_table; the postgresql-dialect ENUM type is what actually
        # honors the flag and skips it.
        sa.Column('role', postgresql.ENUM('user', 'assistant', name='chat_role', create_type=False), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('dashboard_chat_messages')
