from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.review import Review


class FindingCategory(str, Enum):
    bug = "bug"
    security = "security"
    style = "style"
    suggestion = "suggestion"


class FindingSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


SEVERITY_RANK = {
    FindingSeverity.low: 0,
    FindingSeverity.medium: 1,
    FindingSeverity.high: 2,
    FindingSeverity.critical: 3,
}


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[FindingCategory] = mapped_column(SAEnum(FindingCategory, name="finding_category"), nullable=False)
    severity: Mapped[FindingSeverity] = mapped_column(SAEnum(FindingSeverity, name="finding_severity"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_fix: Mapped[str | None] = mapped_column(Text, nullable=True)

    review: Mapped["Review"] = relationship(back_populates="findings")
