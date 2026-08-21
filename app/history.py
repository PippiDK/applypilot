from __future__ import annotations

import hashlib
import json
from pathlib import Path
from .dedupe import fingerprint
from .models import Job


def _description_hash(job: Job) -> str:
    return hashlib.sha1((job.description or "").strip().encode("utf-8")).hexdigest()


class SearchHistory:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.data = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {}
        except Exception:
            self.data = {}

    def classify(self, job: Job) -> str:
        key = fingerprint(job)
        current = _description_hash(job)
        previous = self.data.get(key)
        if previous is None:
            return "NEW"
        if previous.get("description_hash") != current:
            return "UPDATED"
        return "SEEN"

    def remember(self, jobs: list[Job]) -> None:
        for job in jobs:
            self.data[fingerprint(job)] = {
                "description_hash": _description_hash(job),
                "source": job.source,
                "source_job_id": job.source_job_id,
            }
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
