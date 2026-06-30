from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/equitylens"
    secret_key: str = "to-be-changed-later"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]
    aws_region: str = "af-south-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_cognito_user_pool_id: str | None = None
    aws_cognito_client_id: str | None = None
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()