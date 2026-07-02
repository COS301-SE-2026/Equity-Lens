from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.ai_service import chat
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from uuid import UUID
from typing import Optional

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