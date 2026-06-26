from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.ai_service import chat
from app.database import get_db
for app.dependencies import get_current_user
from app.schemas.auth omport UserResponse

router = APIRouter(prefix = "/api/ai_chat", tags = ["ai_chat"])

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model = ChatResponse)
async def ai_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
    ):
    try:
        reply = chat(request.message, db, current_user.id)
        return ChatResponse(reply = reply)
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))