"""
환경 설정.

- 실행 위치(cwd)와 무관하게 저장소 루트의 `.env`, `database/.env`, `agent/.env`(선택)를
  순서대로 로드합니다. 이후 파일이 앞선 파일의 동일 키를 덮어씁니다.
- Docker Compose는 `environment:` 항목으로 `DATABASE_URL`, `BACKEND_URL` 등을
  주입하므로, 호스트용 `.env`와 달라도 컨테이너 내에서는 항상 올바른 연결 URL이 적용됩니다.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DATABASE_ROOT = _REPO_ROOT / "database"
_AGENT_ROOT = Path(__file__).resolve().parent


def _env_files() -> tuple[Path, ...] | None:
    paths: list[Path] = []
    for p in (
        _REPO_ROOT / ".env",
        _DATABASE_ROOT / ".env",
        _AGENT_ROOT / ".env",
    ):
        if p.is_file():
            paths.append(p)
    return tuple(paths) if paths else None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    agent_port: int = 8080
    agent_secret: str = "dev-agent-secret"

    database_url: str = "postgresql://docmonauto:password@localhost:5432/docmonauto"
    # 로컬: localhost. Docker Compose는 BACKEND_URL 환경 변수로 덮어씀.
    backend_url: str = "http://localhost:3001"

    watch_path: str = "/watch"
    storage_id: str = "00000000-0000-0000-0000-000000000010"

    embedding_model: str = "BAAI/bge-m3"
    embedding_dimensions: int = 1024
    embedding_device: str = "cpu"

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
