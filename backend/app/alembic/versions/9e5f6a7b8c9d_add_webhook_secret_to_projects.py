"""add webhook_secret to projects

Revision ID: 9e5f6a7b8c9d
Revises: 8d4e5f6a7b8c
Create Date: 2026-10-27 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9e5f6a7b8c9d'
down_revision: str | None = '8d4e5f6a7b8c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('webhook_secret', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'webhook_secret')
