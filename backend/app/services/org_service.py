from sqlalchemy.orm import Session

from app.models.membership import Membership, MembershipRole
from app.models.organization import Organization
from app.models.user import User


def create_personal_organization(db: Session, user: User) -> Organization:
    """Every new user gets their own organization at signup (role=owner), so
    existing single-user flows keep working unchanged until they invite teammates
    or get invited into someone else's."""
    org = Organization(name=f"{user.username}'s projects")
    db.add(org)
    db.flush()
    db.add(Membership(user_id=user.id, org_id=org.id, role=MembershipRole.owner))
    return org


def get_org_owner_email(db: Session, org_id: int) -> str | None:
    """The earliest owner of the org, used to notify someone when a webhook-triggered
    review finishes — there's no "current user" to notify in that flow."""
    membership = (
        db.query(Membership)
        .filter(Membership.org_id == org_id, Membership.role == MembershipRole.owner)
        .order_by(Membership.id.asc())
        .first()
    )
    if membership is None:
        return None
    user = db.get(User, membership.user_id)
    return user.email if user else None
