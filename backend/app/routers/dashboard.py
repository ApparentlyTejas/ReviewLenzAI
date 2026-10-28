from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.finding import Finding
from app.models.project import Project
from app.models.review import Review
from app.models.user import User
from app.routers.deps import get_current_user
from app.routers.projects import RECENTLY_DELETED_RETENTION_DAYS
from app.schemas.dashboard import DashboardSummary, DeletedReviewOut, FindingsTrendOut, FindingsTrendPoint, RecentReviewOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> DashboardSummary:
    project_ids = [
        pid
        for (pid,) in db.query(Project.id)
        .filter(Project.user_id == current_user.id, Project.deleted_at.is_(None))
        .all()
    ]

    if not project_ids:
        return DashboardSummary(
            total_projects=0, total_reviews=0, total_findings=0, findings_by_severity={}, recent_reviews=[]
        )

    total_reviews = (
        db.query(Review).filter(Review.project_id.in_(project_ids), Review.deleted_at.is_(None)).count()
    )

    total_findings = (
        db.query(Finding)
        .join(Review, Finding.review_id == Review.id)
        .filter(Review.project_id.in_(project_ids), Review.deleted_at.is_(None))
        .count()
    )

    severity_counts = (
        db.query(Finding.severity, func.count(Finding.id))
        .join(Review, Finding.review_id == Review.id)
        .filter(Review.project_id.in_(project_ids), Review.deleted_at.is_(None))
        .group_by(Finding.severity)
        .all()
    )
    findings_by_severity = {severity.value: count for severity, count in severity_counts}

    recent = (
        db.query(Review, Project)
        .join(Project, Review.project_id == Project.id)
        .filter(Review.project_id.in_(project_ids), Review.deleted_at.is_(None))
        .order_by(Review.created_at.desc())
        .limit(5)
        .all()
    )
    recent_reviews = [
        RecentReviewOut(
            id=review.id,
            project_id=project.id,
            repo_owner=project.repo_owner,
            repo_name=project.repo_name,
            pr_number=review.pr_number,
            pr_title=review.pr_title,
            status=review.status.value,
            finding_count=len(review.findings),
            created_at=review.created_at,
        )
        for review, project in recent
    ]

    return DashboardSummary(
        total_projects=len(project_ids),
        total_reviews=total_reviews,
        total_findings=total_findings,
        findings_by_severity=findings_by_severity,
        recent_reviews=recent_reviews,
    )


FINDINGS_TREND_DAYS = 30


@router.get("/findings-trend", response_model=FindingsTrendOut)
def get_findings_trend(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> FindingsTrendOut:
    """Per-day review/finding counts for the last FINDINGS_TREND_DAYS days, for the
    dashboard's trend sparkline. Built from already-loaded review.findings (same
    relationship get_summary uses) rather than a grouped SQL query, since the date
    grouping function differs between SQLite (tests) and Postgres (prod)."""
    project_ids = [
        pid
        for (pid,) in db.query(Project.id)
        .filter(Project.user_id == current_user.id, Project.deleted_at.is_(None))
        .all()
    ]

    cutoff_dt = datetime.now(UTC) - timedelta(days=FINDINGS_TREND_DAYS - 1)
    cutoff_date = cutoff_dt.date()
    counts: dict[date, dict[str, int]] = {}

    if project_ids:
        reviews = (
            db.query(Review)
            .filter(
                Review.project_id.in_(project_ids),
                Review.deleted_at.is_(None),
                Review.created_at >= cutoff_dt,
            )
            .all()
        )
        for review in reviews:
            day = review.created_at.date()
            bucket = counts.setdefault(day, {"review_count": 0, "finding_count": 0})
            bucket["review_count"] += 1
            bucket["finding_count"] += len(review.findings)

    points = []
    for offset in range(FINDINGS_TREND_DAYS):
        day = cutoff_date + timedelta(days=offset)
        bucket = counts.get(day, {"review_count": 0, "finding_count": 0})
        points.append(FindingsTrendPoint(date=day, review_count=bucket["review_count"], finding_count=bucket["finding_count"]))

    return FindingsTrendOut(points=points)


@router.get("/deleted-reviews", response_model=list[DeletedReviewOut])
def list_deleted_reviews(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[DeletedReviewOut]:
    # Only reviews deleted on their own, scoped to still-connected projects — a
    # review whose project was disconnected shows up under the project's own
    # Recently Deleted entry instead (restoring the project un-hides it too).
    cutoff = datetime.now(UTC) - timedelta(days=RECENTLY_DELETED_RETENTION_DAYS)
    expired = (
        db.query(Review)
        .join(Project, Review.project_id == Project.id)
        .filter(Project.user_id == current_user.id, Review.deleted_at.isnot(None), Review.deleted_at < cutoff)
        .all()
    )
    for review in expired:
        db.delete(review)
    if expired:
        db.commit()

    rows = (
        db.query(Review, Project)
        .join(Project, Review.project_id == Project.id)
        .filter(
            Project.user_id == current_user.id,
            Project.deleted_at.is_(None),
            Review.deleted_at.isnot(None),
        )
        .order_by(Review.deleted_at.desc())
        .all()
    )
    return [
        DeletedReviewOut(
            id=review.id,
            project_id=project.id,
            repo_owner=project.repo_owner,
            repo_name=project.repo_name,
            pr_number=review.pr_number,
            pr_title=review.pr_title,
            deleted_at=review.deleted_at,
        )
        for review, project in rows
    ]


@router.post("/deleted-reviews/{review_id}/restore", response_model=RecentReviewOut)
def restore_review(
    review_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> RecentReviewOut:
    row = (
        db.query(Review, Project)
        .join(Project, Review.project_id == Project.id)
        .filter(Review.id == review_id, Project.user_id == current_user.id, Review.deleted_at.isnot(None))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted review not found")
    review, project = row
    if project.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Restore the project first — it was disconnected too.",
        )

    review.deleted_at = None
    db.commit()
    db.refresh(review)
    return RecentReviewOut(
        id=review.id,
        project_id=project.id,
        repo_owner=project.repo_owner,
        repo_name=project.repo_name,
        pr_number=review.pr_number,
        pr_title=review.pr_title,
        status=review.status.value,
        finding_count=len(review.findings),
        created_at=review.created_at,
    )
