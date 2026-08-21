from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable
from urllib.parse import urlencode, urljoin, urlparse, parse_qs

import httpx
from bs4 import BeautifulSoup

from .base import FetchResult, JobSource
from .utils import clean_html, parse_datetime
from ..models import Job, SourceCoverage


@dataclass
class LinkedInDiagnostics:
    search_requests: int = 0
    search_failures: int = 0
    search_rows: int = 0
    detail_requests: int = 0
    detail_failures: int = 0
    incomplete_details: int = 0


class LinkedInPublicSource(JobSource):
    """LinkedIn public (zero-login) search -> public job page -> full JD.

    Deliberately one source only for the first stable end-to-end milestone.
    Search failures and detail failures are surfaced; they are never silently
    reported as a successful zero-result search.
    """

    name = "LinkedIn Jobs"
    channel = "Public job boards"
    search_endpoint = "https://www.linkedin.com/jobs/search/"
    job_base = "https://www.linkedin.com/jobs/view/"

    def __init__(
        self,
        queries: list[str],
        max_details: int = 80,
        detail_concurrency: int = 6,
        transport: httpx.AsyncBaseTransport | None = None,
        now_fn: Callable[[], datetime] | None = None,
    ):
        self.queries = list(dict.fromkeys(q.strip() for q in queries if q and q.strip()))
        self.max_details = max_details
        self.detail_concurrency = detail_concurrency
        self.transport = transport
        self.now_fn = now_fn or (lambda: datetime.now(timezone.utc))

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9,da;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            transport=self.transport,
            timeout=httpx.Timeout(18.0, connect=8.0),
        )

    async def _get_html(self, client: httpx.AsyncClient, url: str) -> str:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await client.get(url)
                response.raise_for_status()
                ctype = response.headers.get("content-type", "").lower()
                text = response.text
                if "html" not in ctype and "<html" not in text[:500].lower():
                    raise RuntimeError(f"Unexpected LinkedIn content type: {ctype or 'unknown'}")
                lower = text.lower()
                if any(marker in lower for marker in ["captcha", "challenge/checkpoint", "authwall"]):
                    raise RuntimeError("LinkedIn public page returned an access wall/challenge")
                return text
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError, RuntimeError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.25 * (attempt + 1))
        assert last_error is not None
        raise last_error

    def _search_url(self, query: str, freshness_days: int) -> str:
        # LinkedIn's public search page accepts f_TPR=r<seconds> for recency.
        seconds = max(86400, freshness_days * 86400)
        params = {
            "keywords": query,
            "location": "Denmark",
            "f_TPR": f"r{seconds}",
            "position": "1",
            "pageNum": "0",
        }
        return f"{self.search_endpoint}?{urlencode(params)}"

    @staticmethod
    def _job_id_from_url(url: str) -> str | None:
        if not url:
            return None
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        for key in ("currentJobId", "jobId"):
            if qs.get(key) and str(qs[key][0]).isdigit():
                return str(qs[key][0])
        m = re.search(r"/jobs/view/(?:[^/?#]*-)?(\d{7,})(?:[/?#]|$)", parsed.path + ("?" + parsed.query if parsed.query else ""))
        return m.group(1) if m else None

    def _parse_search(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        rows: list[dict] = []
        seen: set[str] = set()

        # Current public LinkedIn cards normally expose base-card__full-link.
        anchors = soup.select('a.base-card__full-link[href*="/jobs/view/"]')
        if not anchors:
            anchors = soup.select('a[href*="/jobs/view/"]')

        for anchor in anchors:
            href = anchor.get("href") or ""
            job_id = self._job_id_from_url(href)
            if not job_id or job_id in seen:
                continue
            seen.add(job_id)
            card = anchor.find_parent(["li", "div"])
            title_node = card.select_one("h3.base-search-card__title") if card else None
            company_node = card.select_one("h4.base-search-card__subtitle") if card else None
            location_node = card.select_one("span.job-search-card__location") if card else None
            time_node = card.select_one("time") if card else None
            rows.append(
                {
                    "job_id": job_id,
                    "url": urljoin("https://www.linkedin.com", href),
                    "title": clean_html(title_node.get_text(" ", strip=True) if title_node else anchor.get_text(" ", strip=True)),
                    "company": clean_html(company_node.get_text(" ", strip=True) if company_node else ""),
                    "location": clean_html(location_node.get_text(" ", strip=True) if location_node else ""),
                    "published_at": parse_datetime(time_node.get("datetime") if time_node else None),
                }
            )

        # Important: distinguish a truly empty search from a parser/access regression.
        if not rows and "/jobs/view/" in html:
            raise RuntimeError("LinkedIn search HTML contains job links but no job cards were parsed")
        return rows

    @staticmethod
    def _meta(soup: BeautifulSoup, *, property_name: str | None = None, name: str | None = None) -> str:
        node = None
        if property_name:
            node = soup.find("meta", attrs={"property": property_name})
        if node is None and name:
            node = soup.find("meta", attrs={"name": name})
        return clean_html(node.get("content") if node else "")

    @staticmethod
    def _remote_type(location: str, description: str = "") -> str:
        loc = clean_html(location).lower()
        value = clean_html(description).lower()

        # Location labels such as "Copenhagen (Hybrid)" are strong evidence.
        if re.search(r"\bhybrid\b", loc):
            return "hybrid"
        if re.search(r"\bremote\b", loc):
            return "remote"

        # Work-arrangement language only.  Do not confuse delivery methodology
        # ("hybrid delivery approaches") or global delivery topology
        # ("offshore/onsite delivery model") with office attendance.
        hybrid_patterns = [
            r"\bhybrid (work|working|role|position|setup|arrangement|workplace|schedule)\b",
            r"\b(work|working) from home\b",
            r"\bhome office\b",
            r"\bremote.{0,35}days? per week\b",
            r"\boffice.{0,45}(days? per week|days? a week|per quarter)\b",
            r"\bwork remotely the other days\b",
            r"\bfrom the office.{0,80}remotely the other days\b",
            r"\bat least half \(50%\) of our time.{0,60}in the office\b",
        ]
        if any(re.search(p, value, re.I | re.S) for p in hybrid_patterns):
            return "hybrid"

        remote_patterns = [
            r"\bfully remote\b",
            r"\b100% remote\b",
            r"\bremote (position|role|job|work arrangement)\b",
            r"\bwork remotely\b",
        ]
        if any(re.search(p, value, re.I | re.S) for p in remote_patterns):
            return "remote"

        onsite_patterns = [
            r"\b(on-site|onsite) (position|role|job)\b",
            r"\boffice[- ]based\b",
            r"\bwork from (the )?office\b",
            r"\bphysical presence (will be )?required\b",
            r"\brequired.{0,35}(physical presence|in the office|on-site|onsite)\b",
        ]
        if any(re.search(p, value, re.I | re.S) for p in onsite_patterns):
            return "onsite"
        return "unknown"

    @staticmethod
    def _remote_eligibility(description: str, location: str, remote_type: str) -> str:
        if remote_type != "remote":
            return "NOT APPLICABLE"
        text = clean_html(f"{location} {description}").lower()
        if re.search(r"\b(only|limited to|must be based in)\b.{0,80}\b(germany|france|sweden|norway|netherlands|spain|portugal|poland)\b", text) and not re.search(r"\bdenmark\b|\bdanmark\b", text):
            return "DENMARK EXCLUDED"
        explicit = [
            r"\bremote\s+(?:from\s+)?denmark\b",
            r"\bdenmark\s+(?:is\s+)?(?:eligible|supported|included)\b",
            r"\b(?:eu|eea|europe)\s+remote\b.{0,120}\bdenmark\b",
            r"\bdenmark\b.{0,120}\b(?:employer of record|employment entity|payroll|remote)\b",
        ]
        if any(re.search(p, text, re.I | re.S) for p in explicit):
            return "DENMARK CONFIRMED"
        return "UNVERIFIED"

    @staticmethod
    def _external_apply_url(href: str | None) -> str | None:
        if not href or not str(href).startswith(("http://", "https://")):
            return None
        parsed = urlparse(str(href))
        host = (parsed.hostname or "").lower()
        if host.endswith("linkedin.com"):
            qs = parse_qs(parsed.query)
            for key in ("url", "redirect", "dest", "destination"):
                candidate = (qs.get(key) or [None])[0]
                if candidate and str(candidate).startswith(("http://", "https://")):
                    candidate_host = (urlparse(str(candidate)).hostname or "").lower()
                    if candidate_host and not candidate_host.endswith("linkedin.com"):
                        return str(candidate)
            return None
        return str(href)

    @staticmethod
    def _salary_monthly_dkk(text_value: str) -> tuple[int | None, int | None]:
        text = clean_html(text_value)

        def amount(raw: str) -> int | None:
            # Danish salary formatting can be 50.000,00; English can be 50,000.
            raw = raw.strip()
            if re.search(r"[.,]00$", raw):
                raw = raw[:-3]
            digits = re.sub(r"[^0-9]", "", raw)
            if not digits:
                return None
            value = int(digits)
            return value if 10_000 <= value <= 250_000 else None

        # Require an explicit monthly unit. Never infer a monthly figure from an annual range.
        patterns = [
            r"(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:DKK|kr\.?)?\s*(?:/md|/md\.|pr\.? måned|per month|/month|monthly)\s*[-–—]\s*(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:DKK|kr\.?)?\s*(?:/md|/md\.|pr\.? måned|per month|/month|monthly)",
            r"(?:DKK|kr\.?)\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*[-–—]\s*(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:per month|/month|monthly|pr\.? måned)",
            r"([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*[-–—]\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:DKK|kr\.?)\s*(?:per month|/month|monthly|pr\.? måned)",
        ]
        for pattern in patterns:
            m = re.search(pattern, text, re.I)
            if not m:
                continue
            low, high = amount(m.group(1)), amount(m.group(2))
            if low is not None and high is not None:
                return min(low, high), max(low, high)
        return None, None

    @staticmethod
    def _deadline(description: str, reference_year: int) -> datetime | None:
        text = clean_html(description)
        month_map = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'januar': 1, 'februar': 2, 'marts': 3, 'april': 4, 'maj': 5, 'juni': 6,
            'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
        }
        m = re.search(
            r"(?:deadline for application|application deadline|apply by|ansøgningsfrist)\s*[:\-]?\s*"
            r"([0-3]?[0-9])(?:st|nd|rd|th)?\s+([A-Za-zæøåÆØÅ]+)(?:\s+(20[0-9]{2}))?",
            text, re.I,
        )
        if not m:
            return None
        day = int(m.group(1))
        month = month_map.get(m.group(2).lower())
        if not month:
            return None
        year = int(m.group(3) or reference_year)
        try:
            return datetime(year, month, day, 23, 59, 59, tzinfo=timezone.utc)
        except ValueError:
            return None

    @staticmethod
    def _employment_type(soup: BeautifulSoup, text: str) -> str:
        value = (text or "").lower()
        for criterion in soup.select("li.description__job-criteria-item"):
            label = clean_html(criterion.get_text(" ", strip=True)).lower()
            if "employment type" in label or "ansættelsestype" in label:
                value += " " + label
        if any(x in value for x in ["full-time", "full time", "permanent", "fastansættelse"]):
            return "permanent"
        if any(x in value for x in ["contract", "freelance", "consultant", "konsulent"]):
            return "contract"
        if any(x in value for x in ["temporary", "fixed-term", "fixed term", "tidsbegrænset"]):
            return "fixed-term"
        return "unknown"

    async def _detail(self, client: httpx.AsyncClient, row: dict, semaphore: asyncio.Semaphore) -> tuple[str, Job | None]:
        job_id = str(row.get("job_id") or "").strip()
        if not job_id:
            return "incomplete", None
        url = str(row.get("url") or f"{self.job_base}{job_id}")
        async with semaphore:
            try:
                html = await self._get_html(client, url)
            except Exception:
                return "failed", None

        soup = BeautifulSoup(html, "html.parser")
        closed_text = clean_html(soup.get_text(" ", strip=True)).lower()
        if any(x in closed_text for x in ["no longer accepting applications", "modtager ikke længere ansøgninger"]):
            return "closed", None

        # Critical contract: only the actual LinkedIn detail description container counts as full JD.
        description_node = soup.select_one("div.show-more-less-html__markup") or soup.select_one("div.description__text div.show-more-less-html__markup")
        if description_node is None:
            return "incomplete", None
        description = clean_html(str(description_node))
        if len(description) < 300 or len(description.split()) < 60:
            return "incomplete", None

        title_node = soup.select_one("h1.top-card-layout__title") or soup.select_one("h1")
        company_node = soup.select_one("a.topcard__org-name-link") or soup.select_one("span.topcard__flavor")
        location_node = soup.select_one("span.topcard__flavor--bullet")
        time_node = soup.select_one("time")
        apply_node = soup.select_one('a[data-tracking-control-name*="apply-link-offsite"]') or soup.select_one('a[href*="/redir/redirect"]')

        title = clean_html(title_node.get_text(" ", strip=True) if title_node else row.get("title") or self._meta(soup, property_name="og:title"))
        company = clean_html(company_node.get_text(" ", strip=True) if company_node else row.get("company") or "Employer")
        location = clean_html(location_node.get_text(" ", strip=True) if location_node else row.get("location") or "Denmark")
        if not title:
            return "incomplete", None

        published = parse_datetime(time_node.get("datetime") if time_node else row.get("published_at"))
        remote_type = self._remote_type(location, description)
        remote_eligibility = self._remote_eligibility(description, location, remote_type)
        official_url = self._external_apply_url(apply_node.get("href") if apply_node else None)
        salary_min, salary_max = self._salary_monthly_dkk(closed_text)
        deadline = self._deadline(description, self.now_fn().year)
        if deadline is not None and deadline < self.now_fn():
            return "closed", None

        return "ok", Job(
            source="LinkedIn Jobs",
            source_job_id=job_id,
            company=company,
            title=title,
            location=location,
            country="Denmark" if re.search(r"\b(denmark|danmark)\b", location, re.I) else None,
            remote_type=remote_type,
            remote_eligibility=remote_eligibility,
            employment_type=self._employment_type(soup, description),
            salary_min_dkk_month=salary_min,
            salary_max_dkk_month=salary_max,
            description=description,
            full_jd_verified=True,
            original_url=url,
            official_url=official_url,
            published_at=published,
            deadline=deadline,
            vacancy_status="ACTIVE VIA THIRD PARTY",
        )

    async def fetch(self, freshness_days: int, include_remote_eu: bool = False) -> FetchResult:
        del include_remote_eu  # First milestone: Denmark public LinkedIn search only.
        diagnostics = LinkedInDiagnostics(search_requests=len(self.queries))
        cutoff = self.now_fn() - timedelta(days=freshness_days + 1)

        async with self._client() as client:
            search_results = await asyncio.gather(
                *(self._get_html(client, self._search_url(query, freshness_days)) for query in self.queries),
                return_exceptions=True,
            )

            rows_by_id: dict[str, dict] = {}
            for result in search_results:
                if isinstance(result, Exception):
                    diagnostics.search_failures += 1
                    continue
                try:
                    rows = self._parse_search(result)
                except Exception:
                    diagnostics.search_failures += 1
                    continue
                diagnostics.search_rows += len(rows)
                for row in rows:
                    published = row.get("published_at")
                    if isinstance(published, datetime):
                        if published.tzinfo is None:
                            published = published.replace(tzinfo=timezone.utc)
                        if published < cutoff:
                            continue
                    rows_by_id[str(row["job_id"])] = row

            if diagnostics.search_requests and diagnostics.search_failures == diagnostics.search_requests:
                return FetchResult(
                    jobs=[],
                    coverage=SourceCoverage(
                        source=self.name,
                        channel=self.channel,
                        status="ACCESS LIMITED",
                        detail="All LinkedIn public search requests failed; result count is unknown, not zero.",
                        **diagnostics.__dict__,
                    ),
                )

            selected = list(rows_by_id.values())[: self.max_details]
            diagnostics.detail_requests = len(selected)
            semaphore = asyncio.Semaphore(self.detail_concurrency)
            detail_results = await asyncio.gather(
                *(self._detail(client, row, semaphore) for row in selected),
                return_exceptions=True,
            )

            jobs: list[Job] = []
            for result in detail_results:
                if isinstance(result, Exception):
                    diagnostics.detail_failures += 1
                    continue
                kind, job = result
                if kind == "failed":
                    diagnostics.detail_failures += 1
                elif kind == "incomplete":
                    diagnostics.incomplete_details += 1
                elif kind == "ok" and job is not None:
                    jobs.append(job)

        if not jobs and diagnostics.search_failures:
            status = "ACCESS LIMITED"
            detail = "LinkedIn public search was only partially accessible; zero jobs cannot be treated as a confirmed zero."
        elif diagnostics.detail_requests and not jobs and (diagnostics.detail_failures or diagnostics.incomplete_details):
            status = "ACCESS LIMITED"
            detail = "LinkedIn search returned vacancies, but full public JDs could not be reliably verified."
        elif jobs:
            status = "SEARCHED"
            if diagnostics.search_failures or diagnostics.detail_failures or diagnostics.incomplete_details:
                detail = "LinkedIn public search produced verified full JDs with partial source limitations; diagnostics show the failures."
            else:
                detail = "LinkedIn public search and full public job-description retrieval completed."
        else:
            status = "NO RELEVANT RESULTS"
            detail = "LinkedIn public search completed successfully; no current full-JD vacancies were found for the configured queries."

        return FetchResult(
            jobs=jobs,
            coverage=SourceCoverage(
                source=self.name,
                channel=self.channel,
                status=status,
                detail=detail,
                fetched=len(jobs),
                **diagnostics.__dict__,
            ),
        )
