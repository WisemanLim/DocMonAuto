from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_env: str = "development"
    agent_port: int = 8080
    agent_secret: str = "dev-agent-secret"

    database_url: str = "postgresql://docmonauto:password@localhost:5432/docmonauto"
    backend_url: str = "http://backend:3001"

    watch_path: str = "/watch"
    storage_id: str = "00000000-0000-0000-0000-000000000010"  # local dev storage

    embedding_model: str = "BAAI/bge-m3"
    embedding_dimensions: int = 1024
    embedding_device: str = "cpu"  # "cpu" | "cuda" | "mps"

    log_level: str = "INFO"

    class Config:
        env_file = "../.env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
