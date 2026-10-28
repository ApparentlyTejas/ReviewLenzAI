from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.finding import FindingSeverity


class ProjectCreate(BaseModel):
    repo_owner: str = Field(min_length=1, max_length=255)
    repo_name: str = Field(min_length=1, max_length=255)
    github_pat: str = Field(min_length=1)


class ProjectFromGitHub(BaseModel):
    repo_owner: str = Field(min_length=1, max_length=255)
    repo_name: str = Field(min_length=1, max_length=255)


class ProjectOut(BaseModel):
    id: int
    repo_owner: str
    repo_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeletedProjectOut(BaseModel):
    id: int
    repo_owner: str
    repo_name: str
    created_at: datetime
    deleted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectSettingsOut(BaseModel):
    ignore_patterns: str
    min_severity: FindingSeverity

    model_config = ConfigDict(from_attributes=True)


class ProjectSettingsUpdate(BaseModel):
    ignore_patterns: str = Field(max_length=5000)
    min_severity: FindingSeverity


class WebhookStatusOut(BaseModel):
    enabled: bool
    webhook_url: str


class WebhookCreatedOut(BaseModel):
    enabled: bool
    webhook_url: str
    secret: str


class PullRequestOut(BaseModel):
    number: int
    title: str
    url: str
    author: str
    updated_at: str
