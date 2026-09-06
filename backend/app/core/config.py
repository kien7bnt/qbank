from __future__ import annotations
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    APP_NAME: str = "Edumate"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./qbank.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-must-be-at-least-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # AI Configuration
    AI_PROVIDER: str = "mock"  # mock | gemini | openai | ollama
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"


settings = Settings()

# Load runtime persistent AI config if exists
import json
import os
_ai_cfg_file = os.path.join(os.path.dirname(__file__), "..", "..", "ai_config.json")
if os.path.exists(_ai_cfg_file):
    try:
        with open(_ai_cfg_file, "r", encoding="utf-8") as _f:
            _saved = json.load(_f)
            if _saved.get("AI_PROVIDER"):
                settings.AI_PROVIDER = _saved["AI_PROVIDER"]
            if _saved.get("OPENAI_API_KEY"):
                settings.OPENAI_API_KEY = _saved["OPENAI_API_KEY"]
            if _saved.get("OPENAI_MODEL"):
                settings.OPENAI_MODEL = _saved["OPENAI_MODEL"]
            if _saved.get("GEMINI_API_KEY"):
                settings.GEMINI_API_KEY = _saved["GEMINI_API_KEY"]
            if _saved.get("GEMINI_MODEL"):
                settings.GEMINI_MODEL = _saved["GEMINI_MODEL"]
            if _saved.get("OLLAMA_BASE_URL"):
                settings.OLLAMA_BASE_URL = _saved["OLLAMA_BASE_URL"]
            if _saved.get("OLLAMA_MODEL"):
                settings.OLLAMA_MODEL = _saved["OLLAMA_MODEL"]
    except Exception:
        pass
