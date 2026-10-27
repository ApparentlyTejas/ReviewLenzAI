import json
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.core.database import SessionLocal


def sse_event(event_type: str, **data: object) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def get_session_factory() -> Callable[[], Session]:
    """A dependency wrapping SessionLocal itself (not a session), resolved while a
    route's other dependencies are still alive, so it can be overridden in tests the
    same way get_db is. Unlike get_db, this is handed to a streaming generator that
    opens its own session much later — FastAPI tears down Depends(get_db)'s session
    right after the route function returns a StreamingResponse, well before the
    generator body that actually streams the SSE frames runs.

    Shared by every streaming chat router (review chat, dashboard chat) so overriding
    it once in tests covers all of them.
    """
    return SessionLocal
