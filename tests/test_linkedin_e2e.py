import asyncio
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.pipeline import SearchPipeline
from app.scoring import load_profile
from app.sources.linkedin import LinkedInPublicSource

PROFILE = load_profile(Path(__file__).parent.parent / "config" / "yulia_profile.yaml")
RESUME = (
    "Senior IT delivery manager with enterprise software, systems integration, banking, fintech, payments, "
    "post-trade, regulatory reporting, Azure, SQL, stakeholder management, risk management, budget, dependency "
    "management, distributed engineering teams, release, UAT, cutover, go-live and governance."
)

SEARCH_HTML = """
<html><body>
<ul>
<li>
  <div class="base-card">
    <a class="base-card__full-link" href="https://dk.linkedin.com/jobs/view/senior-it-project-manager-at-goodco-4455000001?position=1&pageNum=0">Senior IT Project Manager</a>
    <h3 class="base-search-card__title">Senior IT Project Manager</h3>
    <h4 class="base-search-card__subtitle">GoodCo</h4>
    <span class="job-search-card__location">Hørsholm, Capital Region of Denmark, Denmark</span>
    <time datetime="2026-08-21">1 day ago</time>
  </div>
</li>
<li>
  <div class="base-card">
    <a class="base-card__full-link" href="https://dk.linkedin.com/jobs/view/senior-project-manager-construction-at-buildco-4455000002?position=2&pageNum=0">Senior Project Manager Construction</a>
    <h3 class="base-search-card__title">Senior Project Manager - Construction</h3>
    <h4 class="base-search-card__subtitle">BuildCo</h4>
    <span class="job-search-card__location">Copenhagen, Denmark</span>
    <time datetime="2026-08-21">1 day ago</time>
  </div>
</li>
</ul>
</body></html>
"""

GOOD_JD = """
Lead enterprise software delivery and systems integration across distributed engineering teams. Own scope, budget,
risks, dependencies and milestones from planning through implementation. Manage senior stakeholders and executive
reporting, delivery governance, release readiness, UAT, cutover, go-live and handover. The role works with Azure,
data platforms, enterprise applications and regulated business systems. You will be accountable for delivery outcomes,
coordinate cross-functional technology teams, manage delivery plans, remove blockers, track risks and dependencies,
and ensure releases meet quality and business expectations. English is required. Danish is preferred but not required.
The role is hybrid from Hørsholm and works with international colleagues across Europe.
"""

BAD_JD = """
Lead a building construction project and civil engineering workstreams from design through completion. Own budget,
risks, dependencies, milestones and programme reporting. Coordinate site contractors, consultants, commissioning,
commercial matters, safety reviews and building delivery. Use digital project reporting tools and manage senior
stakeholders across the construction programme. The successful candidate has deep experience with construction sites,
MEP interfaces, contractor management, building codes and delivery of complex physical facilities. This is a client-side
construction role with responsibility for cost, schedule, quality and safe delivery of the completed building.
"""


def detail_html(title: str, company: str, location: str, jd: str) -> str:
    return f"""
    <html><head><meta property="og:title" content="{title}" /></head><body>
      <h1 class="top-card-layout__title">{title}</h1>
      <a class="topcard__org-name-link">{company}</a>
      <span class="topcard__flavor--bullet">{location}</span>
      <time datetime="2026-08-21"></time>
      <div class="show-more-less-html__markup">{jd}</div>
      <ul><li class="description__job-criteria-item">Employment type Full-time</li></ul>
    </body></html>
    """


def handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/jobs/search/":
        return httpx.Response(200, text=SEARCH_HTML, headers={"content-type": "text/html"})
    if "4455000001" in path:
        return httpx.Response(
            200,
            text=detail_html("Senior IT Project Manager", "GoodCo", "Hørsholm, Capital Region of Denmark, Denmark", GOOD_JD),
            headers={"content-type": "text/html"},
        )
    if "4455000002" in path:
        return httpx.Response(
            200,
            text=detail_html("Senior Project Manager - Construction", "BuildCo", "Copenhagen, Denmark", BAD_JD),
            headers={"content-type": "text/html"},
        )
    return httpx.Response(404, text="not found", headers={"content-type": "text/html"})


def test_linkedin_public_search_full_jd_to_evaluator(tmp_path):
    source = LinkedInPublicSource(
        PROFILE["discovery_queries"],
        max_details=10,
        transport=httpx.MockTransport(handler),
        now_fn=lambda: datetime(2026, 8, 21, tzinfo=timezone.utc),
    )
    pipeline = SearchPipeline(PROFILE, source, tmp_path / "history.json")
    result = asyncio.run(pipeline.run(RESUME, freshness_days=7, only_new_or_updated=False))

    assert result.coverage[0].status == "SEARCHED"
    assert result.coverage[0].search_failures == 0
    assert result.coverage[0].detail_requests == 2
    assert result.stats.full_jd_verified == 2
    assert len(result.jobs) == 1
    assert result.jobs[0].job.company == "GoodCo"
    assert result.jobs[0].job.full_jd_verified is True
    assert result.jobs[0].evaluation.hard_exclusion is False


def test_search_parser_extracts_public_linkedin_job_id():
    source = LinkedInPublicSource(["Senior IT Project Manager"])
    rows = source._parse_search(SEARCH_HTML)
    assert {row["job_id"] for row in rows} == {"4455000001", "4455000002"}
    assert rows[0]["company"] == "GoodCo"


def test_access_wall_is_not_reported_as_zero_results():
    async def run():
        def blocked(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="<html><body>authwall challenge/checkpoint</body></html>", headers={"content-type": "text/html"})
        source = LinkedInPublicSource(["Senior Project Manager"], transport=httpx.MockTransport(blocked))
        return await source.fetch(7, False)

    result = asyncio.run(run())
    assert result.coverage.status == "ACCESS LIMITED"
    assert result.coverage.search_failures == 1
    assert result.coverage.detail_requests == 0
