"""add username to users

Revision ID: 6b1c2d3e4f5a
Revises: 4f8e1a2b3c5d
Create Date: 2026-10-27 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '6b1c2d3e4f5a'
down_revision: str | None = '4f8e1a2b3c5d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('username', sa.String(length=50), nullable=True))
    # Backfill existing rows from the email's local part before enforcing NOT NULL.
    op.execute("UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL")
    op.alter_column('users', 'username', nullable=False)


def downgrade() -> None:
    op.drop_column('users', 'username')
