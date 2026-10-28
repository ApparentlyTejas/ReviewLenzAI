from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.finding import FindingSeverity

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.review import Review


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("org_id", "repo_owner", "repo_name", name="uq_project_org_repo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    repo_owner: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_pat: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Soft delete: "Disconnect" sets this instead of removing the row, so the project
    # (and its review history) can show up in Recently Deleted and be restored.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Newline-separated glob patterns (e.g. "*.lock\ndist/*"); files whose diff path
    # matches one are stripped out of the diff before it's sent to the LLM.
    ignore_patterns: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # Findings below this severity are discarded after the review runs, so a noisy
    # repo doesn't drown real issues in style nitpicks.
    min_severity: Mapped[FindingSeverity] = mapped_column(
        SAEnum(FindingSeverity, name="finding_severity"), nullable=False, server_default=FindingSeverity.low.value
    )
    # Set when auto-review (a GitHub webhook that reviews a PR automatically on
    # open/push) is enabled for this project; null means it's off. Not encrypted
    # like encrypted_pat — this only verifies inbound webhook calls, it doesn't
    # grant any access itself.
    webhook_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="projects")
    reviews: Mapped[list["Review"]] = relationship(back_populates="project", cascade="all, delete-orphan")
