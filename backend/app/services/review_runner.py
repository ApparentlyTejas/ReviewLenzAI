from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.finding import SEVERITY_RANK
from app.models.finding import Finding as FindingModel
from app.models.project import Project
from app.models.review import Review, ReviewStatus
from app.services import github_service
from app.services.crypto_service import decrypt_pat
from app.services.diff_filter import filter_diff, parse_ignore_patterns
from app.services.email_service import send_review_ready_email
from app.services.llm_service import MODEL_NAME, LLMReviewError, review_diff, truncate_diff


def run_review(db: Session, project: Project, pr_number: int, notify_email: str | None) -> Review:
    """Fetches a PR's diff, runs it through the LLM, and persists the resulting
    review + findings. Shared by the authenticated "review this PR" endpoint and
    the GitHub webhook handler, so both apply the same ignore-pattern/severity
    filtering and produce identical review records."""
    pat = decrypt_pat(project.encrypted_pat)

    try:
        pr = github_service.get_pull_request(pat, project.repo_owner, project.repo_name, pr_number)
        diff_text = github_service.get_pull_request_diff(pat, project.repo_owner, project.repo_name, pr_number)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    diff_text = filter_diff(diff_text, parse_ignore_patterns(project.ignore_patterns))

    review = Review(
        project_id=project.id,
        pr_number=pr["number"],
        pr_title=pr["title"],
        pr_url=pr["url"],
        diff_snapshot="",
        status=ReviewStatus.pending,
        model_used=MODEL_NAME,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    try:
        result, diff_snapshot = review_diff(diff_text)
    except LLMReviewError as exc:
        review.status = ReviewStatus.failed
        review.error_message = str(exc)
        review.diff_snapshot = truncate_diff(diff_text)
        db.commit()
        db.refresh(review)
        return review

    review.diff_snapshot = diff_snapshot
    review.status = ReviewStatus.completed
    min_rank = SEVERITY_RANK[project.min_severity]
    kept_findings = [f for f in result.findings if SEVERITY_RANK[f.severity] >= min_rank]
    for finding in kept_findings:
        db.add(
            FindingModel(
                review_id=review.id,
                category=finding.category,
                severity=finding.severity,
                file_path=finding.file_path,
                line_number=finding.line_number,
                message=finding.message,
                suggested_fix=finding.suggested_fix,
            )
        )
    db.commit()
    db.refresh(review)

    if notify_email:
        try:
            review_url = f"{settings.app_url}/projects/{project.id}/reviews/{review.id}"
            send_review_ready_email(
                to=notify_email,
                pr_title=review.pr_title,
                pr_number=review.pr_number,
                repo=f"{project.repo_owner}/{project.repo_name}",
                finding_count=len(review.findings),
                review_url=review_url,
            )
        except Exception:
            pass

    return review
