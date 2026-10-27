from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.chat_message import ChatMessage, ChatRole
from app.models.project import Project
from app.models.review import Review
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.services.llm_service import LLMReviewError, answer_chat_question

router = APIRouter(prefix="/projects/{project_id}/reviews/{review_id}/chat", tags=["chat"])


def _get_owned_review(db: Session, project_id: int, review_id: int, user: User) -> Review:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
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
    current_user: User = Depends(get_current_user),
) -> list[ChatMessage]:
    review = _get_owned_review(db, project_id, review_id, current_user)
    return review.chat_messages


@router.post("", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
def send_chat_message(
    request: Request,
    project_id: int,
    review_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessage:
    review = _get_owned_review(db, project_id, review_id, current_user)

    if review.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat is only available for completed reviews",
        )

    user_message = ChatMessage(review_id=review.id, role=ChatRole.user, content=payload.content)
    db.add(user_message)
    db.commit()

    history = [
        {"role": m.role.value, "content": m.content}
        for m in review.chat_messages
        if m.id != user_message.id
    ]

    try:
        answer = answer_chat_question(
            pr_title=review.pr_title,
            pr_number=review.pr_number,
            diff_snapshot=review.diff_snapshot,
            findings=review.findings,
            history=history,
            question=payload.content,
        )
    except LLMReviewError as exc:
        db.delete(user_message)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    assistant_message = ChatMessage(review_id=review.id, role=ChatRole.assistant, content=answer)
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return assistant_message
