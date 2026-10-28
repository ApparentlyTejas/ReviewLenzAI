from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.finding import Finding
from app.models.review import Review, ReviewStatus


def _finding_key(f: Finding) -> tuple:
    # Location + category + severity is a reasonable proxy for "the same issue" —
    # exact message text can shift slightly between LLM calls even for an
    # unchanged line, so matching on message would under-count what's unchanged.
    return (f.file_path, f.line_number, f.category, f.severity)


@dataclass
class ReviewDelta:
    previous_review_id: int
    resolved_count: int
    new_finding_ids: list[int]
    unchanged_count: int


def compute_delta(db: Session, review: Review) -> ReviewDelta | None:
    """Compares a completed review's findings against the most recent earlier
    completed review of the same PR, so re-reviewing after a push can show
    "N resolved, M new" instead of just a fresh, disconnected findings list."""
    if review.status != ReviewStatus.completed:
        return None

    # Ordered by id, not created_at: two reviews created within the same second
    # (SQLite's func.now() only has second resolution) would otherwise tie, and
    # id is monotonically increasing with insertion order regardless.
    previous = (
        db.query(Review)
        .filter(
            Review.project_id == review.project_id,
            Review.pr_number == review.pr_number,
            Review.id < review.id,
            Review.deleted_at.is_(None),
            Review.status == ReviewStatus.completed,
        )
        .order_by(Review.id.desc())
        .first()
    )
    if previous is None:
        return None

    previous_keys = {_finding_key(f) for f in previous.findings}
    current_keys = {_finding_key(f) for f in review.findings}

    return ReviewDelta(
        previous_review_id=previous.id,
        resolved_count=len(previous_keys - current_keys),
        new_finding_ids=[f.id for f in review.findings if _finding_key(f) not in previous_keys],
        unchanged_count=len(current_keys & previous_keys),
    )
