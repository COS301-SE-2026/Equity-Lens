from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, portfolio
from app.database import create_tables

app = FastAPI(title="EquityLens API", description="API", version="0.1",)

app.add_middleware( CORSMiddleware, allow_origins=settings.cors_origins,
allow_credentials=True, allow_methods=["*"], allow_headers=["*"], )

app.include_router(auth.router)
app.include_router(portfolio.router)


@app.on_event("startup")
def startup():
    create_tables()


@app.get("/health")
def health():
    return {"status": "ok", "service": "EquityLens API"}