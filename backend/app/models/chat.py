import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id = Column(UUID(as_uuid=True), primary_key = True, default = uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete = "CASCADE"), nullable = False) 

    title = Column(String(255), nullable = False, default = "New Chat")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class ChatMessages(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key = True, default = uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.id", ondelete = "CASCADE"), nullable = False) 

    role = Column(String(15), nullable = False)
    content = Column(Text, nullable = False)


    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))