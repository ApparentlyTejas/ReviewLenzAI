"""add soft delete to projects and reviews

Revision ID: 4f8e1a2b3c5d
Revises: 9c2d4e6f8a1b
Create Date: 2026-10-27 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4f8e1a2b3c5d'
down_revision: str | None = '9c2d4e6f8a1b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reviews', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('reviews', 'deleted_at')
    op.drop_column('projects', 'deleted_at')
