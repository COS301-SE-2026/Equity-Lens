from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/equitylens"
    allow_live_market_fallback: bool = False
    alpha_vantage_api_key: str | None = None
    market_data_refresh_ttl_hours: int = 24
    secret_key: str = "to-be-changed-later"  # noqa: S105
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: list[str] = [
        "http://localhost:5173",
        "https://equitylens.co.za",
        "https://www.equitylens.co.za",
    ]
    aws_region: str = "af-south-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_cognito_user_pool_id: str | None = None
    aws_cognito_client_id: str | None = None
    bedrock_model: str = "anthropic.claude-sonnet-4-5-20250929-v1:0"
    bedrock_cheap_model: str = "anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_temperature: float = 0.3
    ai_message_limit: int = 5
    ai_window_limit: int = 60
    ai_daily_limit: int = 50
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    newsdata_api_key: str | None = None
    market_api_key: str | None = None
    news_refresh_floor_hours: int = 6
    news_daily_request_budget: int = 80
    news_nightly_request_budget: int = 60
    event_news_per_user_daily: int = 10
    marketaux_articles_per_request: int = 3
    news_extended_universe: bool = False
    guest_mode_enabled: bool = False
    guest_token_secret: str | None = None
    guest_session_hours: int = 4
    guest_max_active: int = 150
    guest_max_portfolios: int = 3
    guest_max_watchlist: int = 10
    guest_create_per_ip: int = 30
    guest_ai_daily_limit: int = 20
    guest_ai_global_daily_limit: int = 300
    guest_snapshot_pdf_limit: int = 3
    pdf_max_concurrent: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

GUEST_SECRET_MIN_LENGTH = 32


def guest_mode_available() -> bool:
    # a short secret could be brute-forced into a forged guest token, so it counts as off
    secret = settings.guest_token_secret or ""
    return settings.guest_mode_enabled and len(secret) >= GUEST_SECRET_MIN_LENGTH
