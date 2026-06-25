from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import chat

router = APIRouter(prefix = "/api/ai_chat", tags = ["ai_chat"])

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model = ChatResponse)
async def ai_chat(request: ChatRequest):
    try:
        reply = chat(request.message)
        return ChatResponse(reply = reply)
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))