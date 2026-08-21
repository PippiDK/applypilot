from __future__ import annotations

import hashlib
import re
from urllib.parse import urlparse
from .models import Job


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def fingerprint(job: Job) -> str:
    payload = "|".join([_norm(job.company), _norm(job.title), _norm(job.location)])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _is_official(job: Job) -> bool:
    if not job.official_url:
        return False
    source_host = urlparse(str(job.original_url)).netloc.lower()
    official_host = urlparse(str(job.official_url)).netloc.lower()
    return bool(official_host and official_host != source_host)


def deduplicate(jobs: list[Job]) -> list[Job]:
    selected: dict[str, Job] = {}
    for job in jobs:
        key = fingerprint(job)
        prev = selected.get(key)
        if prev is None:
            selected[key] = job
            continue
        # Prefer an official employer link, then fuller JD, then newer publication date.
        prev_ts = prev.published_at.timestamp() if prev.published_at else 0.0
        job_ts = job.published_at.timestamp() if job.published_at else 0.0
        prev_rank = (_is_official(prev), len(prev.description or ""), prev_ts)
        job_rank = (_is_official(job), len(job.description or ""), job_ts)
        if job_rank > prev_rank:
            selected[key] = job
    return list(selected.values())
