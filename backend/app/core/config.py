from __future__ import annotations
from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Executive AI Assistant"
    app_env: Literal["development", "production"] = "development"
    secret_key: str = "change_this_secret_key"
    access_token_expire_minutes: int = 60

    # Database
    database_url: str = "postgresql+asyncpg://execai:execai_dev_password@localhost:5432/execai"
    database_url_sync: str = "postgresql://execai:execai_dev_password@localhost:5432/execai"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # FAISS
    faiss_index_path: str = "./data/faiss"

    # LLM — Option A: OpenAI (paid)
    openai_api_key: str = ""

    # LLM — Option B: Google Gemini (free tier)
    google_api_key: str = ""

    # Embedding
    embedding_model: str = "text-embedding-3-large"

    # Gmail (Phase 2)
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = "http://localhost:8000/api/v1/integrations/gmail/callback"
    gmail_pubsub_topic: str = ""

    # Microsoft / Outlook (Phase 2)
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_tenant_id: str = "common"
    microsoft_redirect_uri: str = "http://localhost:8000/api/v1/integrations/outlook/callback"

    # Zoom (Phase 2)
    zoom_client_id: str = ""
    zoom_client_secret: str = ""
    zoom_redirect_uri: str = "http://localhost:8000/api/v1/integrations/zoom/callback"
    zoom_webhook_secret_token: str = ""

    # Slack (Phase 2)
    slack_bot_token: str = ""
    slack_signing_secret: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def has_gemini(self) -> bool:
        return bool(self.google_api_key)

    @property
    def has_any_llm(self) -> bool:
        return self.has_openai or self.has_gemini


@lru_cache()
def get_settings() -> Settings:
    # Trigger config reload
    return Settings()
