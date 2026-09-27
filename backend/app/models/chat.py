import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id = Column(UUID(as_uuid=True), primary_key = True, default = uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete = "CASCADE"),
        nullable = False,
    )

    title = Column(String(255), nullable = False, default = "New Chat")

    summary = Column(Text, nullable = True)
    summarised = Column(DateTime, nullable = True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class UserMemory(Base):
    """This is one fact the user has told the assistant that is kept across conversations."""
    __tablename__ = "user_memories"

    id = Column(UUID(as_uuid=True), primary_key = True, default = uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete = "CASCADE"),
        nullable = False,
        index = True,
    )

    fact = Column(String(300), nullable = False)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))


class ChatMessages(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key = True, default = uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete = "CASCADE"),
        nullable = False,
    )

    role = Column(String(15), nullable = False)
    content = Column(Text, nullable = False)


    created_at = Column(DateTime, default=lambda: datetime.now(UTC))