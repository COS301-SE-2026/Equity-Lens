import traceback

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.database import create_tables
from app.routers import (
    ai_chat,
    auth,
    import_pdf,
    indicators,
    news,
    pdf_summary,
    portfolio,
    watchlist,
)
from app.routers import market_data as market_data_router
from app.schemas.responses import STATUS_ERROR_CODES

app = FastAPI(title="EquityLens API")


class HealthResponse(BaseModel):
    status: str


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.equitylens.co.za",
        "https://equitylens.co.za",
        "http://localhost:5173",
    ],
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


@app.on_event("startup")
async def startup():
    create_tables()


app.include_router(auth.router)
app.include_router(portfolio.router)


@app.get("/health", response_model=HealthResponse)
async def health():
    return {"status": "ok"}


app.include_router(pdf_summary.router)
app.include_router(watchlist.router)
app.include_router(news.router)
app.include_router(ai_chat.router)
app.include_router(import_pdf.router)
app.include_router(indicators.router)
app.include_router(market_data_router.router)
