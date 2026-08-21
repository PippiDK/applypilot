from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET
import httpx

from .base import JobSource, FetchResult
from .utils import clean_html
from ..models import Job, SourceCoverage


class WeWorkRemotelySource(JobSource):
    name = "We Work Remotely"
    channel = "Remote EU / Europe"
    feed = "https://weworkremotely.com/remote-jobs.rss"

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        if not include_remote_eu:
            return FetchResult(
                jobs=[],
                coverage=SourceCoverage(
                    source=self.name,
                    channel=self.channel,
                    status="NO RELEVANT RESULTS",
                    detail="Remote EU search disabled",
                ),
            )
        cutoff = datetime.now(timezone.utc) - timedelta(days=freshness_days + 1)
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "ApplyPilot/0.2"}, timeout=12) as client:
                r = await client.get(self.feed)
                r.raise_for_status()
            root = ET.fromstring(r.text)
            jobs: list[Job] = []
            for item in root.findall(".//item"):
                def text(tag: str) -> str:
                    node = item.find(tag)
                    return node.text.strip() if node is not None and node.text else ""

                published = text("pubDate")
                try:
                    dt = parsedate_to_datetime(published) if published else None
                    if dt and dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                except Exception:
                    dt = None
                if dt and dt < cutoff:
                    continue

                description = clean_html(text("description"))
                if len(description) < 80:
                    continue
                title_raw = clean_html(text("title"))
                link = text("link")
                if not link:
                    continue

                # dc:creator is namespaced in RSS. Search by local name to avoid namespace coupling.
                creator = ""
                for child in list(item):
                    if child.tag.endswith("creator") and child.text:
                        creator = clean_html(child.text)
                        break

                company = creator or "Employer"
                title = title_raw
                if ":" in title_raw and company == "Employer":
                    left, right = title_raw.split(":", 1)
                    if len(left) < 80:
                        company, title = left.strip(), right.strip()

                jobs.append(
                    Job(
                        source="We Work Remotely",
                        source_job_id=text("guid") or link,
                        company=company,
                        title=title,
                        location="Remote",
                        remote_type="remote",
                        description=description,
                        original_url=link,
                        official_url=link,
                        published_at=dt,
                        vacancy_status="ACTIVE VIA THIRD PARTY",
                    )
                )
            status = "SEARCHED" if jobs else "NO RELEVANT RESULTS"
            return FetchResult(
                jobs=jobs,
                coverage=SourceCoverage(source=self.name, channel=self.channel, status=status, fetched=len(jobs)),
            )
        except Exception as exc:
            return FetchResult(
                jobs=[],
                coverage=SourceCoverage(
                    source=self.name,
                    channel=self.channel,
                    status="ACCESS LIMITED",
                    detail=str(exc)[:160],
                ),
            )
