from __future__ import annotations

import httpx
from .base import JobSource, FetchResult
from .utils import clean_html, deep_lists
from ..models import Job, SourceCoverage


class TheHubSource(JobSource):
    name = "The Hub"
    channel = "Public job boards"
    endpoint = "https://thehub.io/api/v2/jobsandfeatured"

    def __init__(self, pages: int = 3):
        self.pages = pages

    @staticmethod
    def _first(row: dict, *names, default=None):
        for name in names:
            value = row.get(name)
            if value not in (None, "", [], {}):
                return value
        return default

    def _rows(self, payload):
        candidates = []
        for items in deep_lists(payload):
            if items and all(isinstance(x, dict) for x in items[: min(3, len(items))]):
                score = sum(1 for x in items[:10] if any(k in x for k in ["title", "jobTitle", "position", "name"]))
                if score:
                    candidates = items
                    break
        return candidates

    def _to_job(self, row: dict) -> Job | None:
        title = clean_html(self._first(row, "title", "jobTitle", "position", "name", default=""))
        if not title:
            return None
        company_obj = self._first(row, "company", "startup", "organization", default={})
        if isinstance(company_obj, dict):
            company = clean_html(self._first(company_obj, "name", "companyName", default="Employer"))
        else:
            company = clean_html(company_obj or self._first(row, "companyName", default="Employer"))
        location_obj = self._first(row, "location", "jobLocation", default="")
        if isinstance(location_obj, dict):
            location = clean_html(" ".join(str(location_obj.get(k) or "") for k in ["city", "country", "name"]))
        else:
            location = clean_html(location_obj)
        description = clean_html(self._first(row, "description", "jobDescription", "content", "body", "text", default=""))
        url = self._first(row, "url", "jobUrl", "applyUrl", "applicationUrl", "link")
        job_id = str(self._first(row, "id", "_id", "uuid", default=url or title))
        if not url or len(description) < 120:
            return None
        remote = bool(self._first(row, "isRemote", "remote", default=False)) or "remote" in location.lower()
        return Job(
            source="The Hub",
            source_job_id=job_id,
            company=company,
            title=title,
            location=location or ("Remote" if remote else "Denmark"),
            country="Denmark" if "denmark" in (location or "").lower() else None,
            remote_type="remote" if remote else "unknown",
            description=description,
            original_url=str(url),
            official_url=str(url),
            vacancy_status="ACTIVE VIA THIRD PARTY",
        )

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        jobs: list[Job] = []
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "ApplyPilot/0.2"}, timeout=12) as client:
                for page in range(1, self.pages + 1):
                    r = await client.get(self.endpoint, params={"countryCode": "DK", "page": page})
                    r.raise_for_status()
                    for row in self._rows(r.json()):
                        job = self._to_job(row)
                        if job:
                            jobs.append(job)
                if include_remote_eu:
                    r = await client.get(self.endpoint, params={"isRemote": "true", "page": 1})
                    r.raise_for_status()
                    for row in self._rows(r.json()):
                        job = self._to_job(row)
                        if job:
                            jobs.append(job)
            status = "SEARCHED" if jobs else "NO RELEVANT RESULTS"
            return FetchResult(jobs=jobs, coverage=SourceCoverage(source=self.name, channel=self.channel, status=status, fetched=len(jobs)))
        except Exception as exc:
            return FetchResult(jobs=[], coverage=SourceCoverage(source=self.name, channel=self.channel, status="ACCESS LIMITED", detail=str(exc)[:160]))
