from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.finding import Finding, FindingSeverity
from app.models.project import Project
from app.models.review import Review

_SEVERITY_RANK = {
    FindingSeverity.critical: 0,
    FindingSeverity.high: 1,
    FindingSeverity.medium: 2,
    FindingSeverity.low: 3,
}

MAX_FINDINGS_IN_CONTEXT = 40
MAX_RECENT_REVIEWS_IN_CONTEXT = 15


@dataclass
class DashboardContext:
    summary_text: str
    has_any_data: bool


def build_dashboard_context(db: Session, user_id: int) -> DashboardContext:
    """Gathers a snapshot of everything the dashboard assistant should ground its
    answers in: per-project stats, recent reviews, and the most severe open findings.
    Built fresh per request (not cached) since it needs to reflect the latest reviews.
    """
    projects = db.query(Project).filter(Project.user_id == user_id).all()

    if not projects:
        return DashboardContext(
            summary_text="This user has not connected any repositories yet.",
            has_any_data=False,
        )

    project_ids = [p.id for p in projects]
    projects_by_id = {p.id: p for p in projects}

    reviews = (
        db.query(Review)
        .filter(Review.project_id.in_(project_ids))
        .order_by(Review.created_at.desc())
        .all()
    )

    lines: list[str] = []

    lines.append(f"Connected repositories ({len(projects)}):")
    for project in projects:
        project_reviews = [r for r in reviews if r.project_id == project.id]
        lines.append(f"- {project.repo_owner}/{project.repo_name}: {len(project_reviews)} review(s)")

    lines.append("")
    lines.append(f"Recent reviews (most recent first, showing up to {MAX_RECENT_REVIEWS_IN_CONTEXT}):")
    for review in reviews[:MAX_RECENT_REVIEWS_IN_CONTEXT]:
        project = projects_by_id[review.project_id]
        lines.append(
            f"- {project.repo_owner}/{project.repo_name} PR #{review.pr_number} \"{review.pr_title}\" "
            f"[{review.status.value}] — {len(review.findings)} finding(s), created {review.created_at.date()}"
        )

    all_findings: list[tuple[Finding, Review, Project]] = [
        (finding, review, projects_by_id[review.project_id])
        for review in reviews
        for finding in review.findings
    ]

    lines.append("")
    lines.append(f"Total findings across all reviews: {len(all_findings)}")

    if all_findings:
        all_findings.sort(key=lambda t: _SEVERITY_RANK.get(t[0].severity, 99))
        shown = all_findings[:MAX_FINDINGS_IN_CONTEXT]
        lines.append(
            f"Most severe findings (showing {len(shown)} of {len(all_findings)}, "
            "sorted critical/high first):"
        )
        for finding, review, project in shown:
            location = finding.file_path + (f":{finding.line_number}" if finding.line_number else "")
            lines.append(
                f"- [{finding.severity.value}/{finding.category.value}] "
                f"{project.repo_owner}/{project.repo_name} PR #{review.pr_number} {location}: {finding.message}"
            )

    return DashboardContext(summary_text="\n".join(lines), has_any_data=True)
