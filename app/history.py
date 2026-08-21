from __future__ import annotations

import hashlib
import json
from pathlib import Path
from .dedupe import fingerprint
from .models import Job


def _material_hash(job: Job) -> str:
    # Master Prompt material-change fields: JD/responsibilities, deadline,
    # salary, work model, location and status. Title is included as well.
    payload = "\n".join([
        job.title or "",
        job.description or "",
        job.location or "",
        job.remote_type or "",
        job.vacancy_status or "",
        str(job.deadline or ""),
        str(job.salary_min_dkk_month or ""),
        str(job.salary_max_dkk_month or ""),
    ])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


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
        current = _material_hash(job)
        previous = self.data.get(key)
        if previous is None:
            return "NEW"
        if previous.get("material_hash") != current:
            return "UPDATED"
        return "SEEN"

    def remember(self, jobs: list[Job]) -> None:
        for job in jobs:
            self.data[fingerprint(job)] = {
                "material_hash": _material_hash(job),
                "source": job.source,
                "source_job_id": job.source_job_id,
            }
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
