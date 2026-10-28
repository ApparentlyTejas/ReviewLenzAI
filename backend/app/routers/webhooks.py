import hashlib
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.project import Project
from app.services.org_service import get_org_owner_email
from app.services.review_runner import run_review

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# PR actions worth reviewing — "synchronize" is GitHub's name for "new commits
# were pushed to the PR branch", which is also when a re-review is wanted.
_REVIEWABLE_ACTIONS = {"opened", "synchronize", "reopened"}


def _verify_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature_header)


@router.post("/github/{project_id}", status_code=status.HTTP_200_OK)
@limiter.limit("30/hour")
async def github_webhook(
    request: Request,
    project_id: int,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
) -> dict[str, str]:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None or project.webhook_secret is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not configured")

    body = await request.body()
    if not _verify_signature(project.webhook_secret, body, x_hub_signature_256):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    if x_github_event != "pull_request":
        return {"status": "ignored"}

    payload = await request.json()
    if payload.get("action") not in _REVIEWABLE_ACTIONS:
        return {"status": "ignored"}

    pr_number = payload.get("pull_request", {}).get("number")
    if pr_number is None:
        return {"status": "ignored"}

    run_review(db, project, pr_number, notify_email=get_org_owner_email(db, project.org_id))
    return {"status": "review_triggered"}
