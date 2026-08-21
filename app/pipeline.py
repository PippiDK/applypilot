from __future__ import annotations

from datetime import datetime, timezone
import re
from pathlib import Path

from .dedupe import deduplicate
from .history import SearchHistory
from .models import EvaluatedJob, Job, SearchResponse, SearchStats
from .scoring import evaluate_job
from .sources.base import JobSource


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _looks_like_discovery_candidate(job: Job, profile: dict) -> bool:
    title = _norm(job.title)
    description = _norm(job.description)
    if any(signal.lower() in title for signal in profile["discovery_title_signals"]):
        return True
    tech = sum(1 for signal in profile["technology_delivery_signals"] if signal.lower() in description)
    ownership = sum(1 for signal in profile["delivery_ownership_signals"] if signal.lower() in description)
    return tech >= 2 and ownership >= 2


class SearchPipeline:
    """One source only until LinkedIn public search works end-to-end in production."""

    def __init__(self, profile: dict, source: JobSource, history_path: str | Path | None = None):
        self.profile = profile
        self.source = source
        self.history = SearchHistory(history_path or Path(__file__).parent.parent / "data" / "search_history.json")

    async def run(self, resume_text: str, freshness_days: int = 7, max_results: int = 10, only_new_or_updated: bool = True) -> SearchResponse:
        result = await self.source.fetch(freshness_days=freshness_days, include_remote_eu=False)
        raw = result.jobs

        full_jd = [job for job in raw if job.full_jd_verified and job.description]
        deduped = deduplicate(full_jd)
        candidates = [job for job in deduped if _looks_like_discovery_candidate(job, self.profile)]

        evaluated: list[EvaluatedJob] = []
        for job in candidates:
            evaluation = evaluate_job(job, self.profile, resume_text)
            if evaluation.hard_exclusion or evaluation.verdict == "Poor fit":
                continue
            history_status = self.history.classify(job)
            if only_new_or_updated and history_status == "SEEN":
                continue
            evaluated.append(EvaluatedJob(job=job, evaluation=evaluation, history_status=history_status))

        evaluated.sort(
            key=lambda item: (
                item.evaluation.score,
                1 if item.history_status == "NEW" else 0,
                item.job.published_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        worthwhile = evaluated[:max_results]
        self.history.remember(deduped)

        return SearchResponse(
            jobs=worthwhile,
            coverage=[result.coverage],
            stats=SearchStats(
                fetched=len(raw),
                full_jd_verified=len(full_jd),
                deduplicated=len(deduped),
                cheap_filter_passed=len(candidates),
                full_jd_evaluated=len(candidates),
                worthwhile=len(worthwhile),
            ),
        )
