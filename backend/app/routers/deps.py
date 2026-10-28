from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.membership import Membership, MembershipRole
from app.models.organization import Organization
from app.models.user import User

_MANAGE_ROLES = (MembershipRole.owner, MembershipRole.admin)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Prefer Authorization header (explicit token wins); fall back to HttpOnly cookie (browser)
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise credentials_exception

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_exception
    return user


def get_current_org(
    x_org_id: int | None = Header(default=None, alias="X-Org-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Organization:
    """Resolves which organization a request applies to. The frontend sends
    X-Org-Id once a user belongs to more than one org (via an org switcher);
    with no header, we fall back to their earliest membership, so a single-org
    user (everyone, until they create/join a second org) needs no header at all.
    """
    if x_org_id is not None:
        membership = (
            db.query(Membership)
            .filter(Membership.user_id == current_user.id, Membership.org_id == x_org_id)
            .first()
        )
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
        org = db.get(Organization, x_org_id)
    else:
        membership = (
            db.query(Membership)
            .filter(Membership.user_id == current_user.id)
            .order_by(Membership.id.asc())
            .first()
        )
        org = db.get(Organization, membership.org_id) if membership else None

    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    assert membership is not None
    # Not a mapped column — just carries the caller's role in this org alongside it,
    # so a route can require_org_manager() without a second membership query.
    org.current_user_role = membership.role  # type: ignore[attr-defined]
    return org


def require_org_manager(current_org: Organization = Depends(get_current_org)) -> Organization:
    """Gate for actions that shouldn't be open to every org member: deleting a
    project, touching its webhook secret, or changing its review settings."""
    if current_org.current_user_role not in _MANAGE_ROLES:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner or admin can do this"
        )
    return current_org
