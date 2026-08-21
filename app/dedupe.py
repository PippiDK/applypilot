from __future__ import annotations

import hashlib
import re
from .models import Job


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def fingerprint(job: Job) -> str:
    # For the one-source milestone the source_job_id is authoritative
    # identity. This prevents two different requisitions with the same title,
    # company and location from being merged.
    if job.source and job.source_job_id:
        payload = f"{_norm(job.source)}|{_norm(job.source_job_id)}"
    else:
        payload = "|".join([_norm(job.company), _norm(job.title), _norm(job.location)])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def deduplicate(jobs: list[Job]) -> list[Job]:
    selected: dict[str, Job] = {}
    for job in jobs:
        key = fingerprint(job)
        previous = selected.get(key)
        if previous is None:
            selected[key] = job
            continue
        previous_rank = (previous.full_jd_verified, len(previous.description or ""), previous.published_at.timestamp() if previous.published_at else 0.0)
        current_rank = (job.full_jd_verified, len(job.description or ""), job.published_at.timestamp() if job.published_at else 0.0)
        if current_rank > previous_rank:
            selected[key] = job
    return list(selected.values())
