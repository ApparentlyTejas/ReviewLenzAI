"""add organizations and memberships; move projects from user_id to org_id

Revision ID: a1b2c3d4e5f6
Revises: 9e5f6a7b8c9d
Create Date: 2026-10-28 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = '9e5f6a7b8c9d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: created explicitly below with checkfirst, so a retried run
# (e.g. after a deploy crashed partway through) doesn't try to create it twice.
membership_role = postgresql.ENUM('owner', 'admin', 'member', name='membership_role', create_type=False)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    membership_role.create(conn, checkfirst=True)

    if 'organizations' not in existing_tables:
        op.create_table(
            'organizations',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    if 'memberships' not in existing_tables:
        op.create_table(
            'memberships',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role', membership_role, nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint('user_id', 'org_id', name='uq_membership_user_org'),
        )

    existing_project_columns = {c['name'] for c in inspector.get_columns('projects')}
    if 'org_id' not in existing_project_columns:
        op.add_column('projects', sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True))

    # Backfill: every existing user gets a personal org (named after their username)
    # and becomes its owner; every project they had under the old user_id ownership
    # moves to that org. This is a 1:1 user->org mapping today, but a user created
    # after this migration can still invite others into their org afterward.
    # Guarded by "projects still has user_id" so a retried run (after the rest of
    # this migration already completed once) doesn't try to backfill or re-insert
    # memberships for users who already have one.
    if 'user_id' in existing_project_columns:
        users = conn.execute(sa.text("SELECT id, username FROM users")).fetchall()
        for user_id, username in users:
            already_has_org = conn.execute(
                sa.text("SELECT 1 FROM memberships WHERE user_id = :user_id"), {"user_id": user_id}
            ).first()
            if already_has_org:
                continue
            org_id = conn.execute(
                sa.text("INSERT INTO organizations (name, created_at) VALUES (:name, now()) RETURNING id"),
                {"name": f"{username}'s projects"},
            ).scalar()
            conn.execute(
                sa.text(
                    "INSERT INTO memberships (user_id, org_id, role, created_at) "
                    "VALUES (:user_id, :org_id, 'owner', now())"
                ),
                {"user_id": user_id, "org_id": org_id},
            )
            conn.execute(
                sa.text("UPDATE projects SET org_id = :org_id WHERE user_id = :user_id"),
                {"org_id": org_id, "user_id": user_id},
            )

        op.drop_constraint('uq_project_user_repo', 'projects', type_='unique')
        op.alter_column('projects', 'org_id', nullable=False)
        op.create_unique_constraint('uq_project_org_repo', 'projects', ['org_id', 'repo_owner', 'repo_name'])
        op.drop_constraint('projects_user_id_fkey', 'projects', type_='foreignkey')
        op.drop_column('projects', 'user_id')


def downgrade() -> None:
    op.add_column('projects', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT p.id, m.user_id FROM projects p "
            "JOIN memberships m ON m.org_id = p.org_id AND m.role = 'owner'"
        )
    ).fetchall()
    for project_id, user_id in rows:
        conn.execute(sa.text("UPDATE projects SET user_id = :user_id WHERE id = :id"), {"user_id": user_id, "id": project_id})

    op.drop_constraint('uq_project_org_repo', 'projects', type_='unique')
    op.alter_column('projects', 'user_id', nullable=False)
    op.create_unique_constraint('uq_project_user_repo', 'projects', ['user_id', 'repo_owner', 'repo_name'])
    op.drop_column('projects', 'org_id')

    op.drop_table('memberships')
    membership_role.drop(op.get_bind(), checkfirst=True)
    op.drop_table('organizations')
