from __future__ import annotations

from datetime import datetime, timedelta, timezone
import httpx
from .base import JobSource, FetchResult
from .utils import clean_html, parse_datetime
from ..models import Job, SourceCoverage


class RemoteOKSource(JobSource):
    name = "Remote OK"
    channel = "Remote EU / Europe"
    endpoint = "https://remoteok.com/api"

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        if not include_remote_eu:
            return FetchResult(jobs=[], coverage=SourceCoverage(source=self.name, channel=self.channel, status="NO RELEVANT RESULTS", detail="Remote EU search disabled"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=freshness_days + 1)
        jobs: list[Job] = []
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "ApplyPilot/0.2"}, timeout=12) as client:
                r = await client.get(self.endpoint)
                r.raise_for_status()
                rows = r.json()
            for row in rows[1:] if isinstance(rows, list) else []:
                dt = parse_datetime(row.get("date"))
                if dt and dt < cutoff:
                    continue
                description = clean_html(row.get("description"))
                url = row.get("url") or row.get("apply_url")
                if not url:
                    continue
                if len(description) < 120:
                    continue
                location = clean_html(row.get("location") or "Remote")
                # The final evaluator will mark Denmark eligibility unverified unless the posting says so.
                jobs.append(Job(
                    source="Remote OK",
                    source_job_id=str(row.get("id") or row.get("slug")),
                    company=clean_html(row.get("company") or "Employer"),
                    title=clean_html(row.get("position") or ""),
                    location=location,
                    remote_type="remote",
                    employment_type="unknown",
                    salary_min_dkk_month=None,
                    salary_max_dkk_month=None,
                    description=description,
                    original_url=url,
                    official_url=row.get("apply_url") or url,
                    published_at=dt,
                    vacancy_status="ACTIVE VIA THIRD PARTY",
                ))
            status = "SEARCHED" if jobs else "NO RELEVANT RESULTS"
            return FetchResult(jobs=jobs, coverage=SourceCoverage(source=self.name, channel=self.channel, status=status, fetched=len(jobs)))
        except Exception as exc:
            return FetchResult(jobs=[], coverage=SourceCoverage(source=self.name, channel=self.channel, status="ACCESS LIMITED", detail=str(exc)[:160]))
