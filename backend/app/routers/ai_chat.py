from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.ai_service import chat
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from uuid import UUID
from typing import Optional
from app.models.chat import ChatConversation, ChatMessages

router = APIRouter(prefix = "/api/ai_chat", tags = ["ai_chat"])

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[UUID] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: UUID

@router.post("/", response_model = ChatResponse)
async def ai_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
    ):
    try:
        reply, conversation_id = chat(request.message, db, current_user.id, request.conversation_id)
        return ChatResponse(reply = reply, conversation_id = conversation_id)
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))

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