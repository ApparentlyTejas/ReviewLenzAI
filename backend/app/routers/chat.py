from collections.abc import Callable, Generator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.streaming import get_session_factory, sse_event
from app.models.chat_message import ChatMessage, ChatRole
from app.models.organization import Organization
from app.models.project import Project
from app.models.review import Review
from app.routers.deps import get_current_org
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.services.llm_service import LLMReviewError, stream_chat_answer

router = APIRouter(prefix="/projects/{project_id}/reviews/{review_id}/chat", tags=["chat"])


def _get_owned_review(db: Session, project_id: int, review_id: int, org: Organization) -> Review:
    project = db.get(Project, project_id)
    if project is None or project.org_id != org.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    review = db.get(Review, review_id)
    if review is None or review.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return review


@router.get("", response_model=list[ChatMessageOut])
def list_chat_messages(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
) -> list[ChatMessage]:
    review = _get_owned_review(db, project_id, review_id, current_org)
    return review.chat_messages


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_messages(
    project_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
) -> None:
    review = _get_owned_review(db, project_id, review_id, current_org)
    db.query(ChatMessage).filter(ChatMessage.review_id == review.id).delete()
    db.commit()


def _stream_chat_response(
    *,
    review_id: int,
    pr_title: str,
    pr_number: int,
    diff_snapshot: str,
    findings_snapshot: list[dict[str, Any]],
    question: str,
    session_factory: Callable[[], Session],
) -> Generator[str, None, None]:
    """Runs in a threadpool (see StreamingResponse docs) for the lifetime of the whole
    SSE response, well past when the route function returns — so it opens its own DB
    session rather than reusing the route's `Depends(get_db)` one, which FastAPI tears
    down right after the route function returns the StreamingResponse object, before
    this generator body actually runs.
    """
    db = session_factory()
    try:
        history = [
            {"role": m.role.value, "content": m.content}
            for m in (
                db.query(ChatMessage).filter(ChatMessage.review_id == review_id).order_by(ChatMessage.id).all()
            )
        ]

        user_message = ChatMessage(review_id=review_id, role=ChatRole.user, content=question)
        db.add(user_message)
        db.commit()

        accumulated: list[str] = []
        try:
            for delta in stream_chat_answer(
                pr_title=pr_title,
                pr_number=pr_number,
                diff_snapshot=diff_snapshot,
                findings=findings_snapshot,
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

        assistant_message = ChatMessage(review_id=review_id, role=ChatRole.assistant, content="".join(accumulated))
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
def send_chat_message(
    request: Request,
    project_id: int,
    review_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_org: Organization = Depends(get_current_org),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> StreamingResponse:
    review = _get_owned_review(db, project_id, review_id, current_org)

    if review.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat is only available for completed reviews",
        )

    findings_snapshot = [
        {
            "file_path": f.file_path,
            "line_number": f.line_number,
            "severity": f.severity.value,
            "category": f.category.value,
            "message": f.message,
        }
        for f in review.findings
    ]

    return StreamingResponse(
        _stream_chat_response(
            review_id=review.id,
            pr_title=review.pr_title,
            pr_number=review.pr_number,
            diff_snapshot=review.diff_snapshot,
            findings_snapshot=findings_snapshot,
            question=payload.content,
            session_factory=session_factory,
        ),
        media_type="text/event-stream",
    )
