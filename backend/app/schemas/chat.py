from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat_message import ChatRole


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ChatMessageOut(BaseModel):
    id: int
    role: ChatRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
