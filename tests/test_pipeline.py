from pathlib import Path
from app.models import Job, SourceCoverage
from app.pipeline import SearchPipeline
from app.scoring import load_profile
from app.sources.base import JobSource, FetchResult

PROFILE = load_profile(Path(__file__).parent.parent / "config" / "yulia_profile.yaml")
RESUME = """
Senior IT project and delivery manager. Enterprise software, Azure, banking, regulatory reporting,
risk management, stakeholder management, distributed teams, release readiness, cutover and go-live.
"""


class FakeSource(JobSource):
    name = "Fake"
    channel = "Public job boards"

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        jobs = [
            Job(
                source="Fake", source_job_id="good", company="GoodCo", title="Senior IT Project Manager",
                location="Hørsholm", remote_type="hybrid",
                description="Enterprise software project delivery. Own scope, risks, dependencies, milestones, senior stakeholder management, distributed engineering teams, release, cutover and go-live using Azure.",
                original_url="https://example.com/good",
            ),
            Job(
                source="Fake", source_job_id="bad", company="LabCo", title="Senior Project Manager, Drug Discovery",
                location="Hørsholm",
                description="Scientific research programme and laboratory development for drug discovery and product R&D.",
                original_url="https://example.com/bad",
            ),
        ]
        return FetchResult(jobs=jobs, coverage=SourceCoverage(source="Fake", channel=self.channel, status="SEARCHED", fetched=2))


def test_pipeline_returns_only_worthwhile(tmp_path):
    import asyncio
    pipeline = SearchPipeline(PROFILE, [FakeSource()], tmp_path / "history.json")
    result = asyncio.run(pipeline.run(RESUME, only_new_or_updated=False))
    assert len(result.jobs) == 1
    assert result.jobs[0].job.company == "GoodCo"
    assert result.jobs[0].evaluation.verdict in {"Strong fit", "Plausible fit", "Stretch fit"}
