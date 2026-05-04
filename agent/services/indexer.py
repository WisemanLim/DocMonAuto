import json
import structlog
from pgvector.asyncpg import register_vector
from services.db import get_pool
from services.parser import parse_document, ParsedChunk
from services.embedder import EmbedderService

log = structlog.get_logger()

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".html", ".pptx", ".xlsx"}


async def index_document(
    file_path: str,
    document_id: str,
    external_id: str,
    storage_id: str,
    strategy: str,
    embedder: EmbedderService,
    metadata: dict | None = None,
) -> dict:
    ext = "." + file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    if ext not in SUPPORTED_EXTENSIONS:
        return {"status": "skipped", "reason": f"unsupported type: {ext}"}

    chunks = parse_document(file_path)
    if not chunks:
        return {"status": "skipped", "reason": "no content extracted"}

    pool = get_pool()
    async with pool.acquire() as conn:
        await register_vector(conn)
        await _clear_existing(conn, document_id, storage_id)

        # ── Vectorless (FTS) — always fast first ──────────────────
        if strategy in ("VECTORLESS_ONLY", "BOTH"):
            await _index_vectorless(conn, document_id, storage_id, chunks, metadata)

        # ── Vector (embedding) ────────────────────────────────────
        if strategy in ("VECTOR_ONLY", "BOTH"):
            texts = [c.content for c in chunks]
            embeddings = embedder.embed(texts)
            await _index_vector(conn, document_id, storage_id, chunks, embeddings, embedder.model_name, metadata)

    log.info("indexer.done", document_id=document_id, chunks=len(chunks), strategy=strategy)
    return {"status": "ok", "chunkCount": len(chunks), "strategy": strategy}


async def delete_document(document_id: str, storage_id: str) -> dict:
    pool = get_pool()
    async with pool.acquire() as conn:
        await _clear_existing(conn, document_id, storage_id)
    log.info("indexer.deleted", document_id=document_id)
    return {"status": "deleted"}


async def search_documents(
    query: str,
    document_ids: list[str],
    strategy: str,
    embedder: EmbedderService,
    top_k: int = 5,
) -> list[dict]:
    pool = get_pool()
    results: list[dict] = []

    async with pool.acquire() as conn:
        await register_vector(conn)

        if strategy in ("VECTOR_ONLY", "BOTH"):
            vec_results = await _vector_search(conn, query, document_ids, embedder, top_k)
            results.extend(vec_results)

        if strategy in ("VECTORLESS_ONLY", "BOTH"):
            fts_results = await _fts_search(conn, query, document_ids, top_k)
            results.extend(fts_results)

    # Deduplicate by content snippet, sort by score desc
    seen: set[str] = set()
    deduped: list[dict] = []
    for r in sorted(results, key=lambda x: x["score"], reverse=True):
        key = r["content"][:80]
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    return deduped[:top_k]


# ── Private helpers ───────────────────────────────────────────────

async def _clear_existing(conn, document_id: str, storage_id: str):
    await conn.execute(
        "DELETE FROM document_chunks WHERE document_id=$1 AND storage_id=$2",
        document_id, storage_id,
    )
    await conn.execute(
        "DELETE FROM document_page_index WHERE document_id=$1 AND storage_id=$2",
        document_id, storage_id,
    )


async def _index_vectorless(conn, document_id: str, storage_id: str, chunks: list[ParsedChunk], metadata: dict | None):
    rows = [
        (document_id, storage_id, c.page_number, c.section_title, c.content, json.dumps(metadata or {}))
        for c in chunks
    ]
    await conn.executemany(
        """INSERT INTO document_page_index
           (document_id, storage_id, page_number, section_title, content, metadata)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb)""",
        rows,
    )


async def _index_vector(
    conn, document_id: str, storage_id: str,
    chunks: list[ParsedChunk], embeddings: list[list[float]],
    model_name: str, metadata: dict | None,
):
    rows = [
        (document_id, storage_id, c.chunk_index, c.content, emb, json.dumps(metadata or {}))
        for c, emb in zip(chunks, embeddings)
    ]
    await conn.executemany(
        """INSERT INTO document_chunks
           (document_id, storage_id, chunk_index, content, embedding, metadata)
           VALUES ($1,$2,$3,$4,$5::vector,$6::jsonb)""",
        rows,
    )


async def _vector_search(conn, query: str, document_ids: list[str], embedder: EmbedderService, top_k: int) -> list[dict]:
    query_vec = embedder.embed_one(query)
    rows = await conn.fetch(
        """SELECT document_id, storage_id, content, metadata,
                  1 - (embedding <=> $1::vector) AS score
           FROM document_chunks
           WHERE document_id = ANY($2::text[])
           ORDER BY score DESC
           LIMIT $3""",
        query_vec, document_ids, top_k,
    )
    return [{"documentId": r["document_id"], "storageId": r["storage_id"],
             "content": r["content"], "score": float(r["score"]), "source": "vector"} for r in rows]


async def _fts_search(conn, query: str, document_ids: list[str], top_k: int) -> list[dict]:
    rows = await conn.fetch(
        """SELECT document_id, storage_id, content, metadata,
                  ts_rank(search_vector, plainto_tsquery('simple', $1)) AS score
           FROM document_page_index
           WHERE document_id = ANY($2::text[])
             AND search_vector @@ plainto_tsquery('simple', $1)
           ORDER BY score DESC
           LIMIT $3""",
        query, document_ids, top_k,
    )
    return [{"documentId": r["document_id"], "storageId": r["storage_id"],
             "content": r["content"], "score": float(r["score"]), "source": "vectorless"} for r in rows]
