from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from app.services.ai_service import chat, run_post_turn, chat_stream
from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from uuid import UUID
from typing import Optional
from app.models.chat import ChatConversation, ChatMessages, UserMemory
from app.models.portfolio import Portfolios
from app.utils.ai_rate_limit import check_limit
from app.utils.exceptions import ConversationNotFoundException
from app.config import settings
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai_chat", tags=["ai_chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[UUID] = None
    portfolio_id: Optional[UUID] = None
    replace_last: bool = False

    @field_validator("message")
    @classmethod
    def no_empty_messages(cls, v):
        if not v or not v.strip():
            raise ValueError("You cannot send an empty message.")
        return v.strip()


class ChatResponse(BaseModel):
    reply: str
    conversation_id: UUID
    saved_facts: list[str] = []


class ChangeConversationName(BaseModel):
    title: str = Field(min_length=1)


def _messages_today(db: Session, user_id) -> int:
    start = datetime.now(timezone.utc).replace(
        tzinfo = None, hour = 0, minute = 0, second = 0, microsecond = 0)

    return (
        db.query(func.count(ChatMessages.id))
          .join(ChatConversation, ChatMessages.conversation_id == ChatConversation.id)
          .filter(
              ChatConversation.user_id == user_id,
              ChatMessages.role == "user",
              ChatMessages.created_at >= start,
          ).scalar() or 0
    )


def enforce_limit(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    used = _messages_today(db, current_user.id)
    if used >= settings.ai_daily_limit:
        midnight = datetime.now(timezone.utc).replace(
            tzinfo = None, hour = 0, minute = 0, second = 0, microsecond = 0)
        retry_after = max(1, int(86400 - (datetime.now(timezone.utc).replace(tzinfo = None) - midnight).total_seconds()))
        logger.info("daily cap hit: user %s used %s", current_user.id, used)
        raise HTTPException(
            status_code = 429,
            detail = {
                "message": f"You have reached your daily limit of {settings.ai_daily_limit} messages. It resets at midnight UTC.",
                "retry_after": retry_after
            },
            headers = {"Retry-After": str(retry_after)}
        )

    allowed, retry_after = check_limit(
        key=str(current_user.id),
        limit=settings.ai_message_limit,
        window_seconds=settings.ai_window_limit,
    )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "message": (
                    f"You have been rate-limited by sending messages too quick. "
                    f"Try again in {retry_after} seconds."),
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )
    return current_user


@router.post("/", response_model = ChatResponse)
def ai_chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(enforce_limit),
):
    try:
        reply, conversation_id = chat(request.message, db, current_user.id, request.conversation_id, request.portfolio_id, request.replace_last)
        background_tasks.add_task(run_post_turn, conversation_id, current_user.id, request.message)
        return ChatResponse(reply = reply, conversation_id = conversation_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "AI chat failed for user %s (conversation %s): %s",
            current_user.id,
            request.conversation_id,
            e,
        )
        raise HTTPException(status_code=500, detail="Something went wrong") from e



@router.post("/stream/")
async def ai_chat_stream(
    request: ChatRequest,
    current_user: UserResponse = Depends(enforce_limit)
    ):
    def event_source():
        db = SessionLocal()
        conversation_id = None
        try:
            for event in chat_stream(request.message, db, current_user.id, request.conversation_id, request.portfolio_id):
                if event["type"] == "done":
                    conversation_id = event["conversation_id"]
                yield f"data: {json.dumps(event)}\n\n"
        except ConversationNotFoundException:
            yield f"data: {json.dumps({'type': 'error', 'value': 'Conversation not found'})}\n\n"
        except Exception as e:
            logger.exception("AI chat stream failed for user %s: %s", current_user.id, e)
            yield f"data: {json.dumps({'type': 'error', 'value': 'Something went wrong'})}\n\n"
        finally:
            db.close()
            if conversation_id:
                run_post_turn(conversation_id, current_user.id, request.message)

    return StreamingResponse(
        event_source(),
        media_type = "text/event-stream",
        headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/portfolios/")
async def get_chat_portfolios(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    portfolios = db.query(Portfolios).filter(
        Portfolios.user_id == current_user.id
    ).order_by(Portfolios.created_at.asc()).all()
    logger.info("chat portfolios for user %s: %s found", current_user.id, len(portfolios))
    return [
        {
            "id": str(p.id),
            "label": f"Portfolio {i}",
            "portfolio_name": p.portfolio_name,
            "account_number": p.account_number,
        }
        for i, p in enumerate(portfolios, start = 1)
    ]   


# now to return all conversations for the logged user
@router.get("/conversations/")
async def get_conversations(
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    chat_conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == current_user.id)
        .order_by(ChatConversation.updated_at.desc())
        .all()
    )

    return [
        {"id": str(c.id), "title": c.title, "created_at": c.created_at, "updated_at": c.updated_at}
        for c in chat_conversation
    ]


# now to return all messages for the logged user
@router.get("/conversations/{conversation_id}/messages/")
async def get_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    # verification of who conversation belongs to
    chat_conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == current_user.id)
        .first()
    )

    if not chat_conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(ChatMessages)
        .filter(ChatMessages.conversation_id == conversation_id)
        .order_by(ChatMessages.created_at.asc())
        .all()
    )

    return [
        {"id": str(m.id), "role": m.role, "content": m.content, "created_at": m.created_at}
        for m in messages
    ]


# to change the conversation name by editing it
@router.put("/conversations/{conversation_id}/")
async def update_conversation(
    conversation_id: UUID,
    request: ChangeConversationName,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    chat_conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == current_user.id)
        .first()
    )

    if not chat_conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    chat_conversation.title = request.title
    db.commit()

    return {"id": str(chat_conversation.id), "title": chat_conversation.title}


@router.delete("/conversations/{conversation_id}/")
async def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    chat_conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == current_user.id)
        .first()
    )

    if not chat_conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.query(ChatMessages).filter(ChatMessages.conversation_id == conversation_id).delete()
    db.delete(chat_conversation)
    db.commit()

    return {"detail": "Conversation deleted"}


@router.get("/memories/")
async def get_memories(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    memories = db.query(UserMemory).filter(
        UserMemory.user_id == current_user.id
    ).order_by(UserMemory.created_at.asc()).all()

    return [
        {"id": str(m.id), "fact": m.fact, "created_at": m.created_at}
        for m in memories
    ]


@router.delete("/memories/{memory_id}/")
async def delete_memory(
    memory_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    memory = db.query(UserMemory).filter(
        UserMemory.id == memory_id,
        UserMemory.user_id == current_user.id
    ).first()

    if not memory:
        raise HTTPException(status_code = 404, detail = "Memory not found")

    db.delete(memory)
    db.commit()

    return {"detail": "Memory deleted"}