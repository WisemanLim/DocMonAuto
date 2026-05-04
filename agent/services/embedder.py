import structlog
from sentence_transformers import SentenceTransformer

log = structlog.get_logger()


class EmbedderService:
    def __init__(self, model_name: str = "BAAI/bge-m3", device: str = "cpu"):
        log.info("embedder.loading", model=model_name, device=device)
        self.model = SentenceTransformer(model_name, device=device)
        self.model_name = model_name
        log.info("embedder.ready")

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=16,
            show_progress_bar=False,
        )
        return vectors.tolist()

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]
