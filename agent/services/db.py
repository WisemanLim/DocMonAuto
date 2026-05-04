import asyncpg
import structlog

log = structlog.get_logger()
_pool: asyncpg.Pool | None = None


async def init_db(dsn: str):
    global _pool
    # asyncpg uses postgresql:// scheme
    _pool = await asyncpg.create_pool(dsn.replace("postgresql+asyncpg", "postgresql"), min_size=2, max_size=10)
    log.info("db.connected")


async def close_db():
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if not _pool:
        raise RuntimeError("DB pool not initialized")
    return _pool
