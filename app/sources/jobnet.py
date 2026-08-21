from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import asyncio
import httpx

from .base import JobSource, FetchResult
from .utils import clean_html, parse_datetime
from ..models import Job, SourceCoverage


class JobnetSource(JobSource):
    name = "Jobnet"
    channel = "Public job boards"
    base = "https://jobnet.dk/bff"

    def __init__(self, queries: list[str], max_per_query: int = 25, max_details: int = 80):
        self.queries = queries
        self.max_per_query = max_per_query
        self.max_details = max_details

    async def _json(self, client: httpx.AsyncClient, url: str):
        r = await client.get(url, headers={"x-csrf": "1"}, timeout=12)
        r.raise_for_status()
        return r.json()

    async def _search_one(self, client: httpx.AsyncClient, query: str):
        qs = urlencode({
            "resultsPerPage": str(self.max_per_query),
            "pageNumber": "1",
            "orderType": "BestMatch",
            "searchString": query,
            "workHoursType": "FullTime",
        })
        data = await self._json(client, f"{self.base}/FindJob/Search?{qs}")
        return data.get("jobAds", []) if isinstance(data, dict) else []

    async def _detail(self, client: httpx.AsyncClient, row: dict) -> Job | None:
        job_id = str(row.get("jobAdId") or "").strip()
        if not job_id:
            return None
        try:
            data = await self._json(client, f"{self.base}/FindJob/JobAdDetails/{job_id}?incrementViews=false")
        except Exception:
            return None
        body = clean_html(data.get("body") or "")
        if len(body) < 120:
            return None
        address = ((data.get("job") or {}).get("address") or {}) if isinstance(data, dict) else {}
        application = data.get("application") or {}
        official_url = application.get("url")
        if official_url and not str(official_url).startswith(("http://", "https://")):
            official_url = None
        location = " ".join(str(x) for x in [address.get("city"), address.get("postalCode")] if x).strip()
        return Job(
            source="Jobnet",
            source_job_id=job_id,
            company=clean_html(row.get("hiringOrgName") or "Employer"),
            title=clean_html(row.get("title") or ""),
            location=location or clean_html(row.get("postalDistrictName") or row.get("municipality") or "Denmark"),
            country=address.get("countryName") or row.get("country") or "Denmark",
            remote_type="unknown",
            employment_type="permanent" if str(row.get("employmentDurationType") or "").lower() == "permanent" else "unknown",
            description=body,
            original_url=official_url or "https://jobnet.dk/find-job",
            official_url=official_url or None,
            published_at=parse_datetime(row.get("publicationDate")),
            deadline=parse_datetime(application.get("deadlineDate") or data.get("unpublicationDateTime")),
            vacancy_status="ACTIVE VIA THIRD PARTY",
        )

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        cutoff = datetime.now(timezone.utc) - timedelta(days=freshness_days + 1)
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "ApplyPilot/0.2"}) as client:
                batches = await asyncio.gather(*(self._search_one(client, q) for q in self.queries), return_exceptions=True)
                rows: dict[str, dict] = {}
                for batch in batches:
                    if isinstance(batch, Exception):
                        continue
                    for row in batch:
                        job_id = str(row.get("jobAdId") or "")
                        dt = parse_datetime(row.get("publicationDate"))
                        if job_id and (dt is None or dt >= cutoff):
                            rows[job_id] = row
                # Full JD is mandatory before detailed evaluation.
                selected = list(rows.values())[: self.max_details]
                details = await asyncio.gather(*(self._detail(client, r) for r in selected), return_exceptions=True)
                jobs = [j for j in details if isinstance(j, Job)]
            status = "SEARCHED" if jobs else "NO RELEVANT RESULTS"
            return FetchResult(jobs=jobs, coverage=SourceCoverage(source=self.name, channel=self.channel, status=status, fetched=len(jobs)))
        except Exception as exc:
            return FetchResult(jobs=[], coverage=SourceCoverage(source=self.name, channel=self.channel, status="ACCESS LIMITED", detail=str(exc)[:160]))
