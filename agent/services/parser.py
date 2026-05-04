import os
import structlog
from pathlib import Path
from dataclasses import dataclass

log = structlog.get_logger()


@dataclass
class ParsedChunk:
    content: str
    page_number: int | None
    section_title: str | None
    chunk_index: int


def parse_document(file_path: str, chunk_size: int = 800, overlap: int = 100) -> list[ParsedChunk]:
    path = Path(file_path)
    suffix = path.suffix.lower()

    try:
        if suffix == ".pdf":
            return _parse_with_docling(file_path, chunk_size, overlap)
        elif suffix in (".docx", ".doc"):
            return _parse_docx(file_path, chunk_size, overlap)
        elif suffix in (".txt", ".md", ".html"):
            return _parse_text(file_path, chunk_size, overlap)
        else:
            return _parse_text(file_path, chunk_size, overlap)
    except Exception as e:
        log.warning("parser.fallback", file=file_path, error=str(e))
        return _parse_text(file_path, chunk_size, overlap)


def _parse_with_docling(file_path: str, chunk_size: int, overlap: int) -> list[ParsedChunk]:
    from docling.document_converter import DocumentConverter
    converter = DocumentConverter()
    result = converter.convert(file_path)
    full_text = result.document.export_to_markdown()
    return _chunk_text(full_text, chunk_size, overlap)


def _parse_docx(file_path: str, chunk_size: int, overlap: int) -> list[ParsedChunk]:
    import docx
    doc = docx.Document(file_path)
    full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return _chunk_text(full_text, chunk_size, overlap)


def _parse_text(file_path: str, chunk_size: int, overlap: int) -> list[ParsedChunk]:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except Exception:
        return []
    return _chunk_text(text, chunk_size, overlap)


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[ParsedChunk]:
    words = text.split()
    chunks: list[ParsedChunk] = []
    i = 0
    idx = 0
    while i < len(words):
        chunk_words = words[i : i + chunk_size]
        content = " ".join(chunk_words).strip()
        if content:
            chunks.append(ParsedChunk(content=content, page_number=None, section_title=None, chunk_index=idx))
            idx += 1
        i += chunk_size - overlap
    return chunks
