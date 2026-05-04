import asyncio
import structlog
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI

from config import get_settings
from services.db import init_db, close_db
from services.embedder import EmbedderService
from services.watcher import FileWatcherService
from routers import index_router, health_router

log = structlog.get_logger()
settings = get_settings()

embedder: EmbedderService | None = None
watcher: FileWatcherService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedder, watcher

    log.info("agent.startup", watch_path=settings.watch_path)

    await init_db(settings.database_url)

    embedder = EmbedderService(settings.embedding_model, settings.embedding_device)
    app.state.embedder = embedder

    watcher = FileWatcherService(
        watch_path=settings.watch_path,
        storage_id=settings.storage_id,
        backend_url=settings.backend_url,
        agent_secret=settings.agent_secret,
    )
    watcher.start()

    yield

    watcher.stop()
    await close_db()
    log.info("agent.shutdown")


app = FastAPI(title="DocMonAuto Agent", version="0.1.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(index_router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.agent_port, reload=settings.app_env == "development")
