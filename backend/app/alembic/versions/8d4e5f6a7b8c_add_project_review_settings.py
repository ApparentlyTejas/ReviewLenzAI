"""add ignore_patterns and min_severity to projects

Revision ID: 8d4e5f6a7b8c
Revises: 6b1c2d3e4f5a
Create Date: 2026-10-27 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8d4e5f6a7b8c'
down_revision: str | None = '6b1c2d3e4f5a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: this enum type already exists in the DB, created by the
# findings table's own migration — re-declaring it here just reuses that type.
finding_severity = sa.Enum('low', 'medium', 'high', 'critical', name='finding_severity', create_type=False)


def upgrade() -> None:
    op.add_column('projects', sa.Column('ignore_patterns', sa.Text(), nullable=False, server_default=''))
    op.add_column(
        'projects',
        sa.Column('min_severity', finding_severity, nullable=False, server_default='low'),
    )


def downgrade() -> None:
    op.drop_column('projects', 'min_severity')
    op.drop_column('projects', 'ignore_patterns')
