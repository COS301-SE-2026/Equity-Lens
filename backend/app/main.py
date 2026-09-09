import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.routers import auth, portfolio
from app.database import create_tables
from app.config import settings
from app.models import user
from app.models import market_data
from app.schemas.responses import STATUS_ERROR_CODES
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.routers import news
from app.routers import import_pdf
from app.routers import pdf_summary
from app.routers import watchlist
from app.routers import indicators
from app.routers import ai_chat
from app.routers import market_data as market_data_router
from app.services import token_verifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    app.state.jwks_reachable = token_verifier.prefetch_jwks()
    yield


app = FastAPI(title="EquityLens API", lifespan=lifespan)


class HealthResponse(BaseModel):
    status: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = getattr(exc, "error_code", None) or STATUS_ERROR_CODES.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": code, "detail": exc.detail},
        headers=exc.headers,
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error_code": "VALIDATION_ERROR", "detail": jsonable_encoder(exc.errors())},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    response = JSONResponse(
        status_code=500,
        content={"error_code": "INTERNAL_ERROR", "detail": "Something went wrong"},
    )

    origin = request.headers.get("origin")
    if origin in settings.cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response

app.include_router(auth.router)
app.include_router(portfolio.router)

@app.get("/health", response_model=HealthResponse)
async def health():
    return {"status": "ok"}


class AuthHealthResponse(BaseModel):
    pool_id_configured: bool
    client_id_configured: bool
    jwks_reachable: bool

@app.get("/health/auth", response_model=AuthHealthResponse)
async def health_auth(request: Request):
    return {
        "pool_id_configured": bool(settings.aws_cognito_user_pool_id),
        "client_id_configured": bool(settings.aws_cognito_client_id),
        "jwks_reachable": bool(getattr(request.app.state, "jwks_reachable", False)),
    }



app.include_router(pdf_summary.router)
app.include_router(watchlist.router)
app.include_router(news.router)
app.include_router(ai_chat.router)
app.include_router(import_pdf.router)
app.include_router(indicators.router)
app.include_router(market_data_router.router)
