from datetime import datetime

from pydantic import BaseModel, Field

from app.models.membership import MembershipRole


class OrganizationOut(BaseModel):
    id: int
    name: str
    role: MembershipRole
    created_at: datetime


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class MemberOut(BaseModel):
    user_id: int
    email: str
    username: str
    role: MembershipRole


class InviteMemberRequest(BaseModel):
    email: str
    role: MembershipRole = MembershipRole.member


class MemberRoleUpdate(BaseModel):
    role: MembershipRole
