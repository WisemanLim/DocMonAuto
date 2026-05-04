from fastapi import APIRouter, Request, HTTPException, Header
from pydantic import BaseModel
from config import get_settings
from services import indexer

router = APIRouter()
settings = get_settings()


def _verify_secret(x_agent_secret: str | None):
    if x_agent_secret != settings.agent_secret:
        raise HTTPException(status_code=401, detail="Invalid agent secret")


class IndexRequest(BaseModel):
    documentId: str
    externalId: str       # absolute file path for on-premise
    storageId: str
    eventType: str        # CREATE | UPDATE | DELETE
    strategy: str = "BOTH"
    securityLevel: str = "INTERNAL"
    contentType: str = "application/octet-stream"
    metadata: dict | None = None


class SearchRequest(BaseModel):
    query: str
    documentIds: list[str]
    strategy: str = "BOTH"
    topK: int = 5


@router.post("/index")
async def index(req: IndexRequest, request: Request, x_agent_secret: str | None = Header(None)):
    _verify_secret(x_agent_secret)
    embedder = request.app.state.embedder
    result = await indexer.index_document(
        file_path=req.externalId,
        document_id=req.documentId,
        external_id=req.externalId,
        storage_id=req.storageId,
        strategy=req.strategy,
        embedder=embedder,
        metadata=req.metadata,
    )
    return result


@router.post("/index/delete")
async def delete(req: IndexRequest, x_agent_secret: str | None = Header(None)):
    _verify_secret(x_agent_secret)
    return await indexer.delete_document(req.documentId, req.storageId)


@router.post("/search")
async def search(req: SearchRequest, request: Request, x_agent_secret: str | None = Header(None)):
    _verify_secret(x_agent_secret)
    embedder = request.app.state.embedder
    results = await indexer.search_documents(
        query=req.query,
        document_ids=req.documentIds,
        strategy=req.strategy,
        embedder=embedder,
        top_k=req.topK,
    )
    return results
