import type { Finding, Review } from "../types";

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Renders a review's findings as Markdown suitable for pasting into a PR
 * comment, Slack message, or issue — grouped by severity, matching the order
 * findings are already sorted in on the page. */
export function reviewToMarkdown(review: Review, sortedFindings: Finding[]): string {
  const lines: string[] = [];
  lines.push(`## Code review: PR #${review.pr_number} — ${review.pr_title}`);
  lines.push("");
  lines.push(`**Status:** ${review.status} · **Reviewed:** ${new Date(review.created_at).toLocaleString()}`);
  lines.push("");

  if (sortedFindings.length === 0) {
    lines.push("No issues found. Clean diff.");
    return lines.join("\n");
  }

  lines.push(`${sortedFindings.length} finding${sortedFindings.length === 1 ? "" : "s"}:`);
  lines.push("");

  for (const finding of sortedFindings) {
    const location = finding.file_path + (finding.line_number ? `:${finding.line_number}` : "");
    lines.push(`### ${SEVERITY_LABEL[finding.severity]} — ${finding.category} — \`${location}\``);
    lines.push("");
    lines.push(finding.message);
    if (finding.suggested_fix) {
      lines.push("");
      lines.push("**Suggested fix:**");
      lines.push("```");
      lines.push(finding.suggested_fix);
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
