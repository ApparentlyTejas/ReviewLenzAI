-- Seeds a realistic amount of data for load-testing the org-scoped read
-- endpoints (/projects, /dashboard/summary). Run once you have a user and
-- organization (register normally through /auth/register first), against
-- org_id = 1.
INSERT INTO projects (repo_owner, repo_name, encrypted_pat, org_id)
SELECT 'bench-org', 'repo-' || g, 'enc-placeholder-' || g, 1
FROM generate_series(1, 20) AS g;

INSERT INTO reviews (project_id, pr_number, pr_title, pr_url, diff_snapshot, status, model_used, created_at)
SELECT
  p.id,
  r,
  'PR #' || r || ' for ' || p.repo_name,
  'https://github.com/bench-org/' || p.repo_name || '/pull/' || r,
  repeat('diff line ' || r || E'\n', 40),
  'completed',
  'qwen/qwen3.8-27b',
  now() - (r || ' hours')::interval
FROM projects p
CROSS JOIN generate_series(1, 15) AS r
WHERE p.org_id = 1;

INSERT INTO findings (review_id, category, severity, file_path, line_number, message, suggested_fix)
SELECT
  rv.id,
  (ARRAY['bug','security','style','suggestion']::finding_category[])[1 + (f % 4)],
  (ARRAY['critical','high','medium','low']::finding_severity[])[1 + (f % 4)],
  'src/file_' || f || '.py',
  10 * f,
  'Finding ' || f || ' on review ' || rv.id,
  'Suggested fix for finding ' || f
FROM reviews rv
CROSS JOIN generate_series(1, 6) AS f;
