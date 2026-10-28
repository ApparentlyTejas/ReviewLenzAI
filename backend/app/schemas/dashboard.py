from datetime import date, datetime

from pydantic import BaseModel


class RecentReviewOut(BaseModel):
    id: int
    project_id: int
    repo_owner: str
    repo_name: str
    pr_number: int
    pr_title: str
    status: str
    finding_count: int
    created_at: datetime


class DashboardSummary(BaseModel):
    total_projects: int
    total_reviews: int
    total_findings: int
    findings_by_severity: dict[str, int]
    recent_reviews: list[RecentReviewOut]


class FindingsTrendPoint(BaseModel):
    date: date
    review_count: int
    finding_count: int


class FindingsTrendOut(BaseModel):
    points: list[FindingsTrendPoint]


class DeletedReviewOut(BaseModel):
    id: int
    project_id: int
    repo_owner: str
    repo_name: str
    pr_number: int
    pr_title: str
    deleted_at: datetime
