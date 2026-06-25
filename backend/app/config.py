from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/equitylens"
    secret_key: str = "to-be-changed-later"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: List[str] = ["http://localhost:5173"]
    aws_access_key_id: str = ""
    aws_secret_access_key_id: str = ""
    aws_region: str = "us-east-1"
    bedrock_model: str = "amazon.nova-micro-v1:0"
    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()