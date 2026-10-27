from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.finding import Finding as FindingModel
from app.models.project import Project
from app.models.review import Review, ReviewStatus
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.review import ReviewCreate, ReviewOut, ReviewSummaryOut
from app.services import github_service
from app.services.crypto_service import decrypt_pat
from app.services.email_service import send_review_ready_email
from app.services.llm_service import MODEL_NAME, LLMReviewError, review_diff

router = APIRouter(prefix="/projects/{project_id}/reviews", tags=["reviews"])


def _get_owned_project(db: Session, project_id: int, user: User) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def trigger_review(
    request: Request,
    project_id: int,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    project = _get_owned_project(db, project_id, current_user)
    pat = decrypt_pat(project.encrypted_pat)

    try:
        pr = github_service.get_pull_request(pat, project.repo_owner, project.repo_name, payload.pr_number)
        diff_text = github_service.get_pull_request_diff(pat, project.repo_owner, project.repo_name, payload.pr_number)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

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
        db.commit()
        db.refresh(review)
        return review

    review.diff_snapshot = diff_snapshot
    review.status = ReviewStatus.completed
    for finding in result.findings:
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

    try:
        review_url = f"{settings.app_url}/projects/{project.id}/reviews/{review.id}"
        send_review_ready_email(
            to=current_user.email,
            pr_title=review.pr_title,
            pr_number=review.pr_number,
            repo=f"{project.repo_owner}/{project.repo_name}",
            finding_count=len(review.findings),
            review_url=review_url,
        )
    except Exception:
        pass

    return review


@router.get("", response_model=list[ReviewSummaryOut])
def list_reviews(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[dict]:
    project = _get_owned_project(db, project_id, current_user)
    # created_at alone isn't a reliable sort key: two reviews created within
    # the same second (SQLite's func.now() only has second resolution, and
    # even Postgres timestamps can tie under concurrent requests) sort
    # arbitrarily without a tiebreaker. id is monotonically increasing with
    # insertion order, so it's a free, deterministic secondary key.
    reviews = (
        db.query(Review)
        .filter(Review.project_id == project.id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "pr_number": r.pr_number,
            "pr_title": r.pr_title,
            "status": r.status,
            "created_at": r.created_at,
            "finding_count": len(r.findings),
        }
        for r in reviews
    ]


@router.get("/{review_id}", response_model=ReviewOut)
def get_review(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    project = _get_owned_project(db, project_id, current_user)
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    project = _get_owned_project(db, project_id, current_user)
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    db.delete(review)
    db.commit()
