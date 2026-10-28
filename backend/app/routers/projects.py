import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.project import (
    DeletedProjectOut,
    ProjectCreate,
    ProjectFromGitHub,
    ProjectOut,
    ProjectSettingsOut,
    ProjectSettingsUpdate,
    PullRequestOut,
    WebhookCreatedOut,
    WebhookStatusOut,
)
from app.services import github_service
from app.services.crypto_service import decrypt_pat, encrypt_pat

router = APIRouter(prefix="/projects", tags=["projects"])

RECENTLY_DELETED_RETENTION_DAYS = 30


def _get_owned_project(db: Session, project_id: int, user: User) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id or project.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _purge_expired_deleted_projects(db: Session, user: User) -> None:
    """Hard-deletes projects (and, via cascade, their reviews/findings) that have
    been sitting in Recently Deleted past the retention window. Run lazily on every
    read of that list instead of needing a cron job."""
    cutoff = datetime.now(UTC) - timedelta(days=RECENTLY_DELETED_RETENTION_DAYS)
    expired = (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.deleted_at.isnot(None), Project.deleted_at < cutoff)
        .all()
    )
    for project in expired:
        db.delete(project)
    if expired:
        db.commit()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Project:
    try:
        github_service.validate_repo_access(payload.github_pat, payload.repo_owner, payload.repo_name)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    existing = (
        db.query(Project)
        .filter(
            Project.user_id == current_user.id,
            Project.repo_owner == payload.repo_owner,
            Project.repo_name == payload.repo_name,
        )
        .first()
    )
    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project already connected")

    if existing:
        # Reconnecting a repo you'd previously disconnected revives it (and its
        # review history) instead of hitting the uq_project_user_repo constraint.
        existing.deleted_at = None
        existing.encrypted_pat = encrypt_pat(payload.github_pat)
        db.commit()
        db.refresh(existing)
        return existing

    project = Project(
        user_id=current_user.id,
        repo_owner=payload.repo_owner,
        repo_name=payload.repo_name,
        encrypted_pat=encrypt_pat(payload.github_pat),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("/from-github", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project_from_github(
    payload: ProjectFromGitHub, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Project:
    if not current_user.github_access_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="GitHub account not connected.")

    pat = decrypt_pat(current_user.github_access_token)

    try:
        github_service.validate_repo_access(pat, payload.repo_owner, payload.repo_name)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    existing = db.query(Project).filter(
        Project.user_id == current_user.id,
        Project.repo_owner == payload.repo_owner,
        Project.repo_name == payload.repo_name,
    ).first()
    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project already connected")

    if existing:
        existing.deleted_at = None
        existing.encrypted_pat = encrypt_pat(pat)
        db.commit()
        db.refresh(existing)
        return existing

    project = Project(
        user_id=current_user.id,
        repo_owner=payload.repo_owner,
        repo_name=payload.repo_name,
        encrypted_pat=encrypt_pat(pat),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Project]:
    return (
        db.query(Project)
        .filter(Project.user_id == current_user.id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
        .all()
    )


@router.get("/deleted", response_model=list[DeletedProjectOut])
def list_deleted_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Project]:
    _purge_expired_deleted_projects(db, current_user)
    return (
        db.query(Project)
        .filter(Project.user_id == current_user.id, Project.deleted_at.isnot(None))
        .order_by(Project.deleted_at.desc())
        .all()
    )


@router.post("/{project_id}/restore", response_model=ProjectOut)
def restore_project(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Project:
    # No "another active project already uses this repo" conflict to guard against:
    # uq_project_user_repo is unconditional (not filtered on deleted_at), so there can
    # never be a second row for the same (user, owner, repo) while this one is deleted —
    # create_project/create_project_from_github revive this exact row instead.
    project = db.get(Project, project_id)
    if project is None or project.user_id != current_user.id or project.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted project not found")

    project.deleted_at = None
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    project = _get_owned_project(db, project_id, current_user)
    project.deleted_at = datetime.now(UTC)
    db.commit()
    return


@router.get("/{project_id}/settings", response_model=ProjectSettingsOut)
def get_project_settings(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Project:
    return _get_owned_project(db, project_id, current_user)


@router.post("/{project_id}/settings", response_model=ProjectSettingsOut)
def update_project_settings(
    project_id: int,
    payload: ProjectSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    project = _get_owned_project(db, project_id, current_user)
    project.ignore_patterns = payload.ignore_patterns
    project.min_severity = payload.min_severity
    db.commit()
    db.refresh(project)
    return project


def _webhook_url(project_id: int) -> str:
    return f"{settings.api_url}/webhooks/github/{project_id}"


@router.get("/{project_id}/webhook", response_model=WebhookStatusOut)
def get_webhook_status(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> WebhookStatusOut:
    project = _get_owned_project(db, project_id, current_user)
    return WebhookStatusOut(enabled=project.webhook_secret is not None, webhook_url=_webhook_url(project.id))


@router.post("/{project_id}/webhook", response_model=WebhookCreatedOut)
def enable_webhook(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> WebhookCreatedOut:
    """(Re)generates this project's webhook secret. The secret is only ever
    returned here — GitHub needs it once, to put in the repo's webhook settings,
    and the stored value is only used afterward to verify inbound calls."""
    project = _get_owned_project(db, project_id, current_user)
    project.webhook_secret = secrets.token_hex(32)
    db.commit()
    db.refresh(project)
    return WebhookCreatedOut(enabled=True, webhook_url=_webhook_url(project.id), secret=project.webhook_secret)


@router.delete("/{project_id}/webhook", status_code=status.HTTP_204_NO_CONTENT)
def disable_webhook(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    project = _get_owned_project(db, project_id, current_user)
    project.webhook_secret = None
    db.commit()


@router.get("/{project_id}/pulls", response_model=list[PullRequestOut])
def list_pull_requests(
    project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[dict]:
    project = _get_owned_project(db, project_id, current_user)
    pat = decrypt_pat(project.encrypted_pat)
    try:
        return github_service.list_open_pull_requests(pat, project.repo_owner, project.repo_name)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{project_id}/pulls/{pr_number}", response_model=PullRequestOut)
def get_pull_request(
    project_id: int,
    pr_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    project = _get_owned_project(db, project_id, current_user)
    pat = decrypt_pat(project.encrypted_pat)
    try:
        pr = github_service.get_pull_request(pat, project.repo_owner, project.repo_name, pr_number)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return pr
