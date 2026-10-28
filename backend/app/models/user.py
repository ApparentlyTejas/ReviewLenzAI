from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dashboard_chat_message import DashboardChatMessage
    from app.models.membership import Membership


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # A display name so the UI doesn't have to show the full email everywhere.
    # Not unique/validated as an identifier — purely cosmetic, defaults to the
    # email's local part at signup and is editable from Settings.
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verification_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    github_access_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def has_github(self) -> bool:
        return bool(self.github_access_token)

    @property
    def has_password(self) -> bool:
        # Google/GitHub-only signups get hashed_password="" (see auth.py) — they have
        # no password to change until they set one, which isn't supported yet.
        return bool(self.hashed_password)

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    dashboard_chat_messages: Mapped[list["DashboardChatMessage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="DashboardChatMessage.id"
    )
