from collections.abc import Callable, Generator

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.streaming import get_session_factory, sse_event
from app.models.chat_message import ChatRole
from app.models.dashboard_chat_message import DashboardChatMessage
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.services.dashboard_context import build_dashboard_context
from app.services.llm_service import LLMReviewError, stream_dashboard_answer

router = APIRouter(prefix="/dashboard/chat", tags=["dashboard-chat"])


@router.get("", response_model=list[ChatMessageOut])
def list_dashboard_chat_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DashboardChatMessage]:
    return current_user.dashboard_chat_messages


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_dashboard_chat_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    db.query(DashboardChatMessage).filter(DashboardChatMessage.user_id == current_user.id).delete()
    db.commit()


def _stream_dashboard_chat_response(
    *,
    user_id: int,
    question: str,
    session_factory: Callable[[], Session],
) -> Generator[str, None, None]:
    """Same self-contained-session pattern as _stream_chat_response in routers/chat.py
    — see that docstring for why this can't reuse the route's Depends(get_db) session."""
    db = session_factory()
    try:
        history = [
            {"role": m.role.value, "content": m.content}
            for m in (
                db.query(DashboardChatMessage)
                .filter(DashboardChatMessage.user_id == user_id)
                .order_by(DashboardChatMessage.id)
                .all()
            )
        ]

        # Built fresh here (not from the route's own request) so it reflects the
        # latest reviews/findings even if a review completed between page load and
        # the user asking a question.
        context = build_dashboard_context(db, user_id)

        user_message = DashboardChatMessage(user_id=user_id, role=ChatRole.user, content=question)
        db.add(user_message)
        db.commit()

        accumulated: list[str] = []
        try:
            for delta in stream_dashboard_answer(
                context=context.summary_text,
                history=history,
                question=question,
            ):
                accumulated.append(delta)
                yield sse_event("delta", content=delta)
        except LLMReviewError as exc:
            db.delete(user_message)
            db.commit()
            yield sse_event("error", detail=str(exc))
            return

        assistant_message = DashboardChatMessage(
            user_id=user_id, role=ChatRole.assistant, content="".join(accumulated)
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)

        yield sse_event(
            "done",
            message={
                "id": assistant_message.id,
                "role": "assistant",
                "content": assistant_message.content,
                "created_at": assistant_message.created_at.isoformat(),
            },
        )
    finally:
        db.close()


@router.post("", status_code=status.HTTP_200_OK)
@limiter.limit("30/hour")
def send_dashboard_chat_message(
    request: Request,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> StreamingResponse:
    return StreamingResponse(
        _stream_dashboard_chat_response(
            user_id=current_user.id,
            question=payload.content,
            session_factory=session_factory,
        ),
        media_type="text/event-stream",
    )
