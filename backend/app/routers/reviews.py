from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.organization import Organization
from app.models.project import Project
from app.models.review import Review, ReviewStatus
from app.models.user import User
from app.routers.deps import get_current_org, get_current_user
from app.schemas.review import PostCommentOut, ReviewCreate, ReviewDeltaOut, ReviewOut, ReviewSummaryOut
from app.services import github_service
from app.services.crypto_service import decrypt_pat
from app.services.review_delta import ReviewDelta, compute_delta
from app.services.review_markdown import review_to_markdown
from app.services.review_runner import run_review


def _delta_out(delta: ReviewDelta | None) -> ReviewDeltaOut | None:
    return ReviewDeltaOut(**delta.__dict__) if delta is not None else None

router = APIRouter(prefix="/projects/{project_id}/reviews", tags=["reviews"])


def _get_owned_project(db: Session, project_id: int, org: Organization) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.org_id != org.id or project.deleted_at is not None:
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
    current_org: Organization = Depends(get_current_org),
) -> ReviewOut:
    project = _get_owned_project(db, project_id, current_org)
    review = run_review(db, project, payload.pr_number, notify_email=current_user.email)
    out = ReviewOut.model_validate(review)
    out.delta = _delta_out(compute_delta(db, review))
    return out


@router.get("", response_model=list[ReviewSummaryOut])
def list_reviews(
    project_id: int,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
) -> list[dict]:
    project = _get_owned_project(db, project_id, current_org)
    # created_at alone isn't a reliable sort key: two reviews created within
    # the same second (SQLite's func.now() only has second resolution, and
    # even Postgres timestamps can tie under concurrent requests) sort
    # arbitrarily without a tiebreaker. id is monotonically increasing with
    # insertion order, so it's a free, deterministic secondary key.
    reviews = (
        db.query(Review)
        .filter(Review.project_id == project.id, Review.deleted_at.is_(None))
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
    current_org: Organization = Depends(get_current_org),
) -> ReviewOut:
    project = _get_owned_project(db, project_id, current_org)
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id or review.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    out = ReviewOut.model_validate(review)
    out.delta = _delta_out(compute_delta(db, review))
    return out


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
) -> None:
    project = _get_owned_project(db, project_id, current_org)
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id or review.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    review.deleted_at = datetime.now(UTC)
    db.commit()


@router.post("/{review_id}/post-comment", response_model=PostCommentOut)
def post_review_comment(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
) -> PostCommentOut:
    project = _get_owned_project(db, project_id, current_org)
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id or review.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.status != ReviewStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a completed review can be posted")

    pat = decrypt_pat(project.encrypted_pat)
    review_url = f"{settings.app_url}/projects/{project.id}/reviews/{review.id}"
    body = review_to_markdown(review, review_url)

    try:
        comment_url = github_service.post_issue_comment(
            pat, project.repo_owner, project.repo_name, review.pr_number, body
        )
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return PostCommentOut(comment_url=comment_url)
