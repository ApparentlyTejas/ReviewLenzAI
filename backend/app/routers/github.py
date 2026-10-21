from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import User
from app.routers.deps import get_current_user
from app.services import github_service
from app.services.crypto_service import decrypt_pat

router = APIRouter(prefix="/github", tags=["github"])


def _get_github_token(current_user: User) -> str:
    if not current_user.github_access_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="GitHub account not connected.")
    return decrypt_pat(current_user.github_access_token)


@router.get("/repos")
def list_repos(current_user: User = Depends(get_current_user)) -> list[dict]:
    pat = _get_github_token(current_user)
    try:
        return github_service.list_user_repos(pat)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/repos/{owner}/{repo}/pulls")
def list_repo_pulls(owner: str, repo: str, current_user: User = Depends(get_current_user)) -> list[dict]:
    pat = _get_github_token(current_user)
    try:
        return github_service.list_open_pull_requests(pat, owner, repo)
    except github_service.GitHubAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except github_service.GitHubNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
