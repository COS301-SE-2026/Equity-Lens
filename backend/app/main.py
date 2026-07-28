from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, portfolio
from app.database import create_tables
from app.config import settings
from app.models import user
from app.models import market_data
from fastapi.responses import PlainTextResponse
import traceback
from app.routers import news
from app.routers import import_pdf
from app.routers import pdf_summary
from app.routers import watchlist
from app.routers import indicators
from app.routers import ai_chat
from app.routers import market_data as market_data_router

app = FastAPI(title="EquityLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(tb)
    return PlainTextResponse(str(tb), status_code=500)

@app.on_event("startup")
async def startup():
    create_tables()

app.include_router(auth.router)
app.include_router(portfolio.router)

@app.get("/health")
async def health():
    return {"status": "ok"}



app.include_router(pdf_summary.router)
app.include_router(watchlist.router)
app.include_router(news.router, prefix="/api")
app.include_router(ai_chat.router)
app.include_router(import_pdf.router)
app.include_router(indicators.router)
app.include_router(market_data_router.router)
