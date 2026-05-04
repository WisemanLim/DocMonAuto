import time
import mimetypes
import os
import httpx
import structlog
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

log = structlog.get_logger()

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".html", ".pptx", ".xlsx"}


class StorageEventHandler(FileSystemEventHandler):
    def __init__(self, storage_id: str, backend_url: str, agent_secret: str):
        self.storage_id = storage_id
        self.backend_url = backend_url
        self.agent_secret = agent_secret

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            self._notify("CREATE", event.src_path)

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            self._notify("UPDATE", event.src_path)

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            self._notify("DELETE", event.src_path)

    def on_moved(self, event: FileSystemEvent):
        if not event.is_directory:
            self._notify("DELETE", event.src_path)
            self._notify("CREATE", event.dest_path)

    def _notify(self, event_type: str, file_path: str):
        path = Path(file_path)
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return

        size = 0
        try:
            size = path.stat().st_size if event_type != "DELETE" else 0
        except Exception:
            pass

        content_type, _ = mimetypes.guess_type(file_path)
        payload = {
            "eventType": event_type,
            "storageId": self.storage_id,
            "externalId": str(path),
            "name": path.name,
            "contentType": content_type or "application/octet-stream",
            "sizeBytes": size,
            "securityLevel": "INTERNAL",  # default; override via file tags/metadata
            "jurisdiction": "GLOBAL",
        }

        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    f"{self.backend_url}/api/v1/internal/events/storage",
                    json=payload,
                    headers={"x-agent-secret": self.agent_secret},
                )
                log.info("watcher.notified", event=event_type, file=path.name, status=resp.status_code)
        except Exception as e:
            log.warning("watcher.notify_failed", event=event_type, file=path.name, error=str(e))


class FileWatcherService:
    def __init__(self, watch_path: str, storage_id: str, backend_url: str, agent_secret: str):
        self.watch_path = watch_path
        self.observer = Observer()
        handler = StorageEventHandler(storage_id, backend_url, agent_secret)
        self.observer.schedule(handler, watch_path, recursive=True)

    def start(self):
        os.makedirs(self.watch_path, exist_ok=True)
        self.observer.start()
        log.info("watcher.started", path=self.watch_path)

    def stop(self):
        self.observer.stop()
        self.observer.join()
        log.info("watcher.stopped")
