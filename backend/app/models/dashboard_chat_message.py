from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.chat_message import ChatRole

if TYPE_CHECKING:
    from app.models.user import User


class DashboardChatMessage(Base):
    """Chat tied to a user's overall dashboard (all their projects/reviews), as
    opposed to ChatMessage which is scoped to one specific review."""

    __tablename__ = "dashboard_chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[ChatRole] = mapped_column(SAEnum(ChatRole, name="chat_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="dashboard_chat_messages")
