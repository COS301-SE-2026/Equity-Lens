from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator, Field
from sqlalchemy.orm import Session
from app.services.ai_service import chat
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from uuid import UUID
from typing import Optional
from app.models.chat import ChatConversation, ChatMessages
from app.utils.ai_rate_limit import check_limit
from app.config import settings

router = APIRouter(prefix = "/api/ai_chat", tags = ["ai_chat"])

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[UUID] = None

    @field_validator("message")
    @classmethod
    def no_empty_messages(cls, v):
        if not v or not v.strip():
            raise ValueError("You cannot send an empty message.")
        return v.strip()

class ChatResponse(BaseModel):
    reply: str
    conversation_id: UUID

class ChangeConversationName(BaseModel):
    title: str = Field(min_length = 1)


def enforce_limit(current_user: UserResponse = Depends(get_current_user)):
    allowed, retry_after = check_limit(
        key = str(current_user.id),
        limit = settings.ai_message_limit,
        window_seconds = settings.ai_window_limit
    )

    if not allowed:
        raise HTTPException(
            status_code = 429,
            detail = {
                "message": f"You have been rate-limited by sending messages too quick. Try again in {retry_after} seconds.",
                "retry_after": retry_after
            },
            headers = {"Retry-After": str(retry_after)}
        )
    return current_user


@router.post("/", response_model = ChatResponse)
async def ai_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(enforce_limit)
    ):
    try:
        reply, conversation_id = chat(request.message, db, current_user.id, request.conversation_id)
        return ChatResponse(reply = reply, conversation_id = conversation_id)
    except Exception as e:
        print(f"AI chat fail: {e}")
        raise HTTPException(status_code = 500, detail = "Something went wrong")

# now to return all conversations for the logged user
@router.get("/conversations/")
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    chat_conversation = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()

    return [
        {
            "id": str(c.id),
            "title": c.title,
            "created_at": c.created_at, 
            "updated_at": c.updated_at
        }
        for c in chat_conversation
    ]


# now to return all messages for the logged user
@router.get("/conversations/{conversation_id}/messages/")
async def get_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    #verification of who conversation belongs to
    chat_conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not chat_conversation:
        raise HTTPException(status_code = 404, detail = "Conversation not found")
    
    messages = db.query(ChatMessages).filter(
        ChatMessages.conversation_id == conversation_id
    ).order_by(ChatMessages.created_at.asc()).all()

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in messages
    ]

# to change the conversation name by editing it
@router.put("/conversations/{conversation_id}/")
async def update_conversation(
    conversation_id: UUID,
    request: ChangeConversationName,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
    ):
    chat_conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not chat_conversation:
        raise HTTPException(status_code = 404, detail = "Conversation not found")
    
    chat_conversation.title = request.title
    db.commit()

    return {"id": str(chat_conversation.id), "title": chat_conversation.title}


@router.delete("/conversations/{conversation_id}/")
async def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
    ):
    chat_conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not chat_conversation:
        raise HTTPException(status_code = 404, detail = "Conversation not found")
    
    db.query(ChatMessages).filter(
        ChatMessages.conversation_id == conversation_id
    ).delete()
    db.delete(chat_conversation)
    db.commit()

    return {"detail": "Conversation deleted"}