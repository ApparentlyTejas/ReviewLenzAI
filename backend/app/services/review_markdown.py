from app.models.finding import FindingSeverity
from app.models.review import Review

_SEVERITY_LABEL = {
    FindingSeverity.critical: "Critical",
    FindingSeverity.high: "High",
    FindingSeverity.medium: "Medium",
    FindingSeverity.low: "Low",
}

_SEVERITY_RANK = {
    FindingSeverity.critical: 0,
    FindingSeverity.high: 1,
    FindingSeverity.medium: 2,
    FindingSeverity.low: 3,
}

def review_to_markdown(review: Review, review_url: str) -> str:
    """Renders a review's findings as a GitHub-flavored Markdown comment body,
    most severe first, for posting directly on the PR."""
    findings = sorted(review.findings, key=lambda f: _SEVERITY_RANK.get(f.severity, 99))

    lines: list[str] = []
    if not findings:
        lines.append("## ReviewLenzAI: no issues found")
        lines.append("")
        lines.append("Clean diff — nothing to flag.")
    else:
        plural = "" if len(findings) == 1 else "s"
        lines.append(f"## ReviewLenzAI found {len(findings)} issue{plural}")
        lines.append("")
        for finding in findings:
            location = finding.file_path + (f":{finding.line_number}" if finding.line_number else "")
            lines.append(f"### {_SEVERITY_LABEL[finding.severity]} — {finding.category.value} — `{location}`")
            lines.append("")
            lines.append(finding.message)
            if finding.suggested_fix:
                lines.append("")
                lines.append("**Suggested fix:**")
                lines.append("```")
                lines.append(finding.suggested_fix)
                lines.append("```")
            lines.append("")

    lines.append(f"\n[View full review]({review_url})")
    return "\n".join(lines).rstrip()
