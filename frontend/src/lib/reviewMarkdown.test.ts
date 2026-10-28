import { describe, expect, it } from "vitest";
import { reviewToMarkdown } from "./reviewMarkdown";
import type { Finding, Review } from "../types";

const REVIEW: Review = {
  id: 1,
  project_id: 1,
  pr_number: 42,
  pr_title: "Fix login bug",
  pr_url: "https://github.com/x/y/pull/42",
  status: "completed",
  error_message: null,
  model_used: "test-model",
  created_at: "2026-01-01T00:00:00Z",
  findings: [],
  diff_snapshot: "",
  delta: null,
};

const FINDING: Finding = {
  id: 1,
  category: "security",
  severity: "critical",
  file_path: "app.py",
  line_number: 12,
  message: "SQL injection via unsanitized query parameter.",
  suggested_fix: "Use parameterized queries.",
};

describe("reviewToMarkdown", () => {
  it("renders a clean-diff message when there are no findings", () => {
    const md = reviewToMarkdown(REVIEW, []);
    expect(md).toContain("PR #42");
    expect(md).toContain("No issues found");
  });

  it("includes each finding's severity, location, message, and fix", () => {
    const md = reviewToMarkdown(REVIEW, [FINDING]);
    expect(md).toContain("Critical");
    expect(md).toContain("app.py:12");
    expect(md).toContain("SQL injection via unsanitized query parameter.");
    expect(md).toContain("Use parameterized queries.");
  });

  it("omits the suggested-fix block when a finding has none", () => {
    const md = reviewToMarkdown(REVIEW, [{ ...FINDING, suggested_fix: null }]);
    expect(md).not.toContain("Suggested fix");
  });
});
