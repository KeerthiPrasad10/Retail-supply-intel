"""Runtime configuration, loaded from environment / .env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root is two levels up from this file's package dir (pipelines/src/rsi).
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SQLITE_PATH = REPO_ROOT / "data" / "rsi.db"


class Settings(BaseSettings):
    """Pipeline settings.

    The store is chosen by ``database_url``:
    - unset  -> local SQLite at ``data/rsi.db`` (zero-config dev)
    - set    -> any SQLAlchemy URL, e.g. a Supabase Postgres connection string
    """

    model_config = SettingsConfigDict(
        env_prefix="RSI_",
        env_file=(".env", str(REPO_ROOT / ".env")),
        extra="ignore",
    )

    database_url: str | None = None

    # UN Comtrade: the modern API issues a free-tier subscription key on
    # registration. Without it the connector falls back to the public preview
    # endpoint (lower limits, recent periods only).
    comtrade_api_key: str | None = None

    # Network politeness / resilience.
    http_timeout: float = 30.0
    user_agent: str = "retail-supply-intel/0.1 (+https://github.com/KeerthiPrasad10/Retail-supply-intel)"

    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        DEFAULT_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{DEFAULT_SQLITE_PATH}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
