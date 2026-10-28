from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.membership import Membership, MembershipRole
from app.models.organization import Organization
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.organization import (
    InviteMemberRequest,
    MemberOut,
    MemberRoleUpdate,
    OrganizationCreate,
    OrganizationOut,
)

router = APIRouter(prefix="/orgs", tags=["orgs"])

_MANAGE_ROLES = (MembershipRole.owner, MembershipRole.admin)


def _get_membership(db: Session, org_id: int, user_id: int) -> Membership:
    membership = db.query(Membership).filter(Membership.org_id == org_id, Membership.user_id == user_id).first()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return membership


@router.get("", response_model=list[OrganizationOut])
def list_my_organizations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    memberships = db.query(Membership).filter(Membership.user_id == current_user.id).order_by(Membership.id.asc()).all()
    return [
        {"id": m.organization.id, "name": m.organization.name, "role": m.role, "created_at": m.organization.created_at}
        for m in memberships
    ]


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    org = Organization(name=payload.name)
    db.add(org)
    db.flush()
    membership = Membership(user_id=current_user.id, org_id=org.id, role=MembershipRole.owner)
    db.add(membership)
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name, "role": membership.role, "created_at": org.created_at}


@router.get("/{org_id}/members", response_model=list[MemberOut])
def list_members(
    org_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[dict]:
    _get_membership(db, org_id, current_user.id)
    members = db.query(Membership).filter(Membership.org_id == org_id).order_by(Membership.id.asc()).all()
    return [
        {"user_id": m.user.id, "email": m.user.email, "username": m.user.username, "role": m.role} for m in members
    ]


@router.post("/{org_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def invite_member(
    org_id: int,
    payload: InviteMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    requester = _get_membership(db, org_id, current_user.id)
    if requester.role not in _MANAGE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner or admin can invite members")

    invitee = db.query(User).filter(User.email == payload.email).first()
    if invitee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ReviewLenzAI account with that email")

    existing = db.query(Membership).filter(Membership.org_id == org_id, Membership.user_id == invitee.id).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a member of this organization")

    role = payload.role
    if role == MembershipRole.owner and requester.role != MembershipRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can add another owner")

    membership = Membership(user_id=invitee.id, org_id=org_id, role=role)
    db.add(membership)
    db.commit()
    return {"user_id": invitee.id, "email": invitee.email, "username": invitee.username, "role": membership.role}


@router.post("/{org_id}/members/{user_id}/role", response_model=MemberOut)
def update_member_role(
    org_id: int,
    user_id: int,
    payload: MemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    requester = _get_membership(db, org_id, current_user.id)
    if requester.role != MembershipRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can change member roles")

    target = db.query(Membership).filter(Membership.org_id == org_id, Membership.user_id == user_id).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target.role == MembershipRole.owner and payload.role != MembershipRole.owner:
        remaining_owners = (
            db.query(Membership).filter(Membership.org_id == org_id, Membership.role == MembershipRole.owner).count()
        )
        if remaining_owners <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An organization needs at least one owner")

    target.role = payload.role
    db.commit()
    return {"user_id": target.user.id, "email": target.user.email, "username": target.user.username, "role": target.role}


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    org_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    requester = _get_membership(db, org_id, current_user.id)
    target = db.query(Membership).filter(Membership.org_id == org_id, Membership.user_id == user_id).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target.user_id != current_user.id and requester.role not in _MANAGE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner or admin can remove members")

    if target.role == MembershipRole.owner:
        remaining_owners = (
            db.query(Membership).filter(Membership.org_id == org_id, Membership.role == MembershipRole.owner).count()
        )
        if remaining_owners <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An organization needs at least one owner")

    db.delete(target)
    db.commit()
