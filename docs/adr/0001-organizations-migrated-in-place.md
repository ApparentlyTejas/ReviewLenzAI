# ADR 1: Multi-tenancy migrated in place, not designed in from day one

## Context

Projects originally belonged directly to a `user_id`. Once teams needed to share review history and invite teammates, ownership had to move to an `organization`, with `memberships` giving each user a role (`owner`/`admin`/`member`) on it. That meant changing the meaning of an existing, populated `projects.org_id` column in production, not adding a new greenfield table.

The naive version of this migration (`ALTER TABLE projects ADD COLUMN org_id ...; UPDATE ...; ALTER COLUMN org_id SET NOT NULL`) is a single shot: if it fails partway through a production deploy, Alembic needs the migration to be safely re-runnable on the next deploy attempt, not just the first one.

## Decision

`backend/app/alembic/versions/a1b2c3d4e5f6_...py` creates one personal organization per existing user (named `"{username}'s projects"`), makes that user its `owner`, and reassigns every one of their projects to it, before dropping the old `user_id` column. Every destructive or creating step is guarded by checking current state first:

- `membership_role.create(conn, checkfirst=True)` instead of assuming the enum doesn't exist yet.
- `if 'organizations' not in existing_tables` / `if 'memberships' not in existing_tables` before `create_table`.
- Per user, `already_has_org = ... SELECT 1 FROM memberships WHERE user_id = :user_id`, skipping the backfill for anyone who already has one.
- The entire backfill block is further guarded by `if 'user_id' in existing_project_columns`, so a retry that already dropped the column (meaning the migration previously finished) does nothing at all.

This is what actually happened in production: the first run of this migration crashed partway through a deploy. The retry on the next deploy picked up exactly where the crash left off, because every step above checks "has this already happened?" before acting, instead of assuming a clean slate.

## Alternatives considered

- **A separate one-off backfill script, run manually before the schema migration.** Rejected: that reintroduces exactly the "did this already run?" problem, just outside Alembic's version tracking instead of inside it, and a manual script is easier to run twice by accident or skip during a rushed deploy.
- **Drop and recreate the column on every migration run (no guards).** Rejected outright: it would have silently destroyed the org/membership rows created during the crashed first attempt and reassigned fresh random organizations to users who already had the correct one, which is worse than the crash itself.

## Consequences

- Every future migration in this codebase that touches existing rows (not just new tables) follows the same pattern: inspect current state with `sa.inspect()`, then act, rather than assuming a migration either hasn't started or has fully finished.
- The personal-org-per-user model is a 1:1 mapping today. A user created after this migration can still invite others into their org afterward, so the shape generalizes without a second migration.
- `downgrade()` has to reverse the same ambiguity: it reconstructs `user_id` from the `owner` membership on each project's org, which only works because "owner" was fixed as the role assigned during the forward migration.
