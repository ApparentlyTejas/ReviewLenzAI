from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.finding import FindingCategory, FindingSeverity
from app.models.review import ReviewStatus


class ReviewCreate(BaseModel):
    pr_number: int


class FindingOut(BaseModel):
    id: int
    category: FindingCategory
    severity: FindingSeverity
    file_path: str
    line_number: int | None
    message: str
    suggested_fix: str | None

    model_config = ConfigDict(from_attributes=True)


class ReviewDeltaOut(BaseModel):
    previous_review_id: int
    resolved_count: int
    new_finding_ids: list[int]
    unchanged_count: int


class ReviewOut(BaseModel):
    id: int
    project_id: int
    pr_number: int
    pr_title: str
    pr_url: str
    status: ReviewStatus
    error_message: str | None
    model_used: str
    created_at: datetime
    findings: list[FindingOut] = []
    # Exactly what the LLM reviewed (possibly truncated for very large diffs —
    # see _truncate_diff) — not refetched live from GitHub, so findings' file/line
    # references always match what's actually shown here, even if the PR changed since.
    diff_snapshot: str
    # Set only when an earlier completed review of the same PR exists — compares
    # this review's findings against that one. See review_delta.compute_delta.
    delta: ReviewDeltaOut | None = None

    model_config = ConfigDict(from_attributes=True)


class PostCommentOut(BaseModel):
    comment_url: str


class ReviewSummaryOut(BaseModel):
    id: int
    pr_number: int
    pr_title: str
    status: ReviewStatus
    created_at: datetime
    finding_count: int

    model_config = ConfigDict(from_attributes=True)


class Finding(BaseModel):
    """Schema for a single LLM-produced finding, used as the Groq tool-call response shape."""

    category: FindingCategory
    severity: FindingSeverity
    file_path: str = Field(description="Path of the file the finding applies to")
    line_number: int | None = Field(default=None, description="Line number in the diff, if identifiable")
    message: str = Field(description="Explanation of the issue")
    suggested_fix: str | None = Field(default=None, description="A concrete suggested fix, if applicable")


class ReviewFindings(BaseModel):
    """Top-level schema the LLM must populate via tool-call for a code review."""

    findings: list[Finding]
