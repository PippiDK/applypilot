from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import re
from pathlib import Path

from .dedupe import deduplicate
from .history import SearchHistory
from .models import EvaluatedJob, Job, SearchResponse, SearchStats, SourceCoverage
from .scoring import evaluate_job
from .sources.base import JobSource, FetchResult


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _looks_like_discovery_candidate(job: Job, profile: dict) -> bool:
    title = _norm(job.title)
    description = _norm(job.description)
    title_signals = [x.lower() for x in profile["discovery_title_signals"]]
    if any(signal in title for signal in title_signals):
        return True
    # Title is only a discovery signal; allow nonstandard titles when the JD itself is strongly IT-delivery shaped.
    tech = sum(1 for x in profile["technology_delivery_signals"] if x.lower() in description)
    delivery = sum(1 for x in profile["delivery_ownership_signals"] if x.lower() in description)
    return tech >= 2 and delivery >= 2


def _fresh(job: Job, days: int) -> bool:
    if job.published_at is None:
        return True  # Missing date is not invented; later output can say insufficient data.
    dt = job.published_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt >= datetime.now(timezone.utc) - timedelta(days=days + 1)


class SearchPipeline:
    def __init__(self, profile: dict, sources: list[JobSource], history_path: str | Path | None = None):
        self.profile = profile
        self.sources = sources
        self.history = SearchHistory(history_path or Path(__file__).parent.parent / "data" / "search_history.json")

    async def run(self, resume_text: str, freshness_days: int = 7, max_results: int = 10, include_remote_eu: bool = True, only_new_or_updated: bool = True) -> SearchResponse:
        results = await asyncio.gather(
            *(source.fetch(freshness_days=freshness_days, include_remote_eu=include_remote_eu) for source in self.sources),
            return_exceptions=True,
        )

        coverage: list[SourceCoverage] = []
        raw: list[Job] = []
        for source, result in zip(self.sources, results):
            if isinstance(result, Exception):
                coverage.append(SourceCoverage(source=source.name, channel=source.channel, status="ACCESS LIMITED", detail=str(result)[:160]))
            else:
                coverage.append(result.coverage)
                raw.extend(result.jobs)

        # Required source registry from the Master Prompt. We do not pretend unsupported sites were searched.
        searched_names = {c.source for c in coverage}
        for name, channel in self.profile["required_source_registry"]:
            if name not in searched_names:
                coverage.append(SourceCoverage(source=name, channel=channel, status="ACCESS LIMITED", detail="No stable zero-auth connector in this MVP build"))

        normalized = [j for j in raw if j.description and len(j.description) >= 80 and _fresh(j, freshness_days)]
        deduped = deduplicate(normalized)
        candidates = [j for j in deduped if _looks_like_discovery_candidate(j, self.profile)]

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
            key=lambda x: (
                x.evaluation.score,
                1 if x.history_status == "NEW" else 0,
                x.job.published_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        worthwhile = evaluated[:max_results]
        self.history.remember(deduped)

        stats = SearchStats(
            fetched=len(raw),
            normalized=len(normalized),
            deduplicated=len(deduped),
            cheap_filter_passed=len(candidates),
            full_jd_evaluated=len(candidates),
            worthwhile=len(worthwhile),
        )
        return SearchResponse(jobs=worthwhile, coverage=coverage, stats=stats)
