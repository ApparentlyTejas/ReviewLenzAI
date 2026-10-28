import secrets
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    RegisterResponse,
    ResendVerificationRequest,
    TokenResponse,
    UpdateUsernameRequest,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.services.crypto_service import encrypt_pat
from app.services.email_service import send_verification_email, send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])

_SAMESITE: Literal["none", "lax"] = "none" if settings.cookie_secure else "lax"
_COOKIE_KWARGS: dict[str, Any] = {
    "httponly": True,
    "secure": settings.cookie_secure,
    "samesite": _SAMESITE,
}


def _default_username(email: str) -> str:
    return email.split("@")[0][:50]


def _set_auth_cookies(response: Response, token: str) -> None:
    max_age = settings.jwt_expire_minutes * 60
    response.set_cookie(key="access_token", value=token, max_age=max_age, **_COOKIE_KWARGS)
    response.set_cookie(
        key="auth_hint", value="1", max_age=max_age,
        httponly=False, secure=settings.cookie_secure, samesite=_SAMESITE,
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: UserRegister, db: Session = Depends(get_db)) -> RegisterResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(
        email=payload.email,
        username=_default_username(payload.email),
        hashed_password=hash_password(payload.password),
        is_verified=True,
    )
    db.add(user)
    db.commit()

    try:
        send_welcome_email(user.email)
    except Exception:
        pass

    return RegisterResponse(message="Account created! You can now sign in.")


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
def resend_verification(request: Request, payload: ResendVerificationRequest, db: Session = Depends(get_db)) -> None:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.is_verified:
        return
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    db.commit()
    try:
        send_verification_email(user.email, token)
    except Exception:
        pass


@router.get("/verify", response_model=TokenResponse)
def verify_email(token: str, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link.")

    user.is_verified = True
    user.verification_token = None
    db.commit()
    db.refresh(user)

    jwt = create_access_token(subject=str(user.id))
    _set_auth_cookies(response, jwt)

    try:
        send_welcome_email(user.email)
    except Exception:
        pass

    return TokenResponse(access_token=jwt)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, response: Response, payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in.")

    token = create_access_token(subject=str(user.id))
    _set_auth_cookies(response, token)
    return TokenResponse(access_token=token)


class GooglePayload(BaseModel):
    access_token: str


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
def google_login(request: Request, response: Response, payload: GooglePayload, db: Session = Depends(get_db)) -> TokenResponse:
    # Verify access token by fetching user info from Google
    r = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {payload.access_token}"},
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    id_info = r.json()
    email: str = id_info.get("email", "")
    user = db.query(User).filter(User.email == email).first()
    is_new = user is None

    if is_new:
        username = id_info.get("given_name") or id_info.get("name") or _default_username(email)
        user = User(email=email, username=username[:50], hashed_password="", is_verified=True)
        db.add(user)
        db.commit()
        db.refresh(user)

    assert user is not None

    if is_new:
        try:
            send_welcome_email(email)
        except Exception:
            pass

    token = create_access_token(subject=str(user.id))
    _set_auth_cookies(response, token)
    return TokenResponse(access_token=token)


class GitHubPayload(BaseModel):
    code: str


@router.post("/github", response_model=TokenResponse)
@limiter.limit("10/minute")
def github_login(request: Request, response: Response, payload: GitHubPayload, db: Session = Depends(get_db)) -> TokenResponse:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub login is not configured.")

    token_r = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={"client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": payload.code},
        timeout=10,
    )
    access_token = token_r.json().get("access_token") if token_r.status_code == 200 else None
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub code.")

    user_r = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        timeout=10,
    )
    if user_r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to get GitHub user info.")

    github_user = user_r.json()
    email: str | None = github_user.get("email")

    if not email:
        emails_r = httpx.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=10,
        )
        if emails_r.status_code == 200:
            primary = next((e for e in emails_r.json() if e.get("primary") and e.get("verified")), None)
            if primary:
                email = primary["email"]

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No verified email found on GitHub account.")

    user = db.query(User).filter(User.email == email).first()
    is_new = user is None

    if is_new:
        username = github_user.get("login") or github_user.get("name") or _default_username(email)
        user = User(email=email, username=username[:50], hashed_password="", is_verified=True)
        db.add(user)

    assert user is not None
    user.github_access_token = encrypt_pat(access_token)
    db.commit()
    db.refresh(user)

    if is_new:
        try:
            send_welcome_email(email)
        except Exception:
            pass

    token = create_access_token(subject=str(user.id))
    _set_auth_cookies(response, token)
    return TokenResponse(access_token=token)


@router.post("/github/connect", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def github_connect(request: Request, payload: GitHubPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub login is not configured.")

    token_r = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={"client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": payload.code},
        timeout=10,
    )
    access_token = token_r.json().get("access_token") if token_r.status_code == 200 else None
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub code.")

    current_user.github_access_token = encrypt_pat(access_token)
    db.commit()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key="access_token", **_COOKIE_KWARGS)
    response.delete_cookie(key="auth_hint", httponly=False, secure=settings.cookie_secure, samesite=_SAMESITE)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/username", response_model=UserOut)
def update_username(
    payload: UpdateUsernameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    current_user.username = payload.username
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not current_user.has_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account signed in with Google or GitHub and has no password to change.",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.post("/github/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def github_disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    current_user.github_access_token = None
    db.commit()


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def delete_account(
    request: Request,
    payload: DeleteAccountRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if current_user.has_password:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    db.delete(current_user)
    db.commit()

    response.delete_cookie(key="access_token", **_COOKIE_KWARGS)
    response.delete_cookie(key="auth_hint", httponly=False, secure=settings.cookie_secure, samesite=_SAMESITE)
