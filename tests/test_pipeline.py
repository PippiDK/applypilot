from pathlib import Path
import asyncio

from app.models import Job, SourceCoverage
from app.pipeline import SearchPipeline
from app.scoring import load_profile
from app.sources.base import FetchResult, JobSource

PROFILE = load_profile(Path(__file__).parent.parent / 'config' / 'yulia_profile.yaml')
RESUME = (
    'Senior IT delivery manager with enterprise software, systems integration, Azure, banking, regulatory reporting, '
    'risk management, stakeholder management, budget, distributed teams, release, UAT, cutover and go-live.'
)


class FakeLinkedIn(JobSource):
    name = 'LinkedIn Jobs'
    channel = 'Public job boards'

    async def fetch(self, freshness_days: int, include_remote_eu: bool) -> FetchResult:
        good = Job(
            source='LinkedIn Jobs', source_job_id='good', company='GoodCo', title='Senior IT Project Manager',
            location='Hørsholm 2970', country='Danmark', full_jd_verified=True,
            description=(
                'Enterprise software delivery and systems integration. Own scope, budget, risks, dependencies and milestones. '
                'Lead distributed engineering teams, senior stakeholders, release readiness, UAT, cutover and go-live using Azure. '
            ) * 3,
            original_url='https://dk.linkedin.com/jobs/view/good-4455000001',
        )
        unverified = Job(
            source='LinkedIn Jobs', source_job_id='snippet', company='SnippetCo', title='IT Project Manager',
            location='Copenhagen', country='Danmark', full_jd_verified=False,
            description='IT project manager snippet with risks and delivery.',
            original_url='https://dk.linkedin.com/jobs/view/snippet-4455000002',
        )
        return FetchResult(
            jobs=[good, unverified],
            coverage=SourceCoverage(source='LinkedIn Jobs', channel=self.channel, status='SEARCHED', fetched=2),
        )


def test_pipeline_evaluates_only_verified_full_jd(tmp_path):
    pipeline = SearchPipeline(PROFILE, FakeLinkedIn(), tmp_path / 'history.json')
    result = asyncio.run(pipeline.run(RESUME, only_new_or_updated=False))
    assert result.stats.fetched == 2
    assert result.stats.full_jd_verified == 1
    assert result.stats.full_jd_evaluated == 1
    assert len(result.jobs) == 1
    assert result.jobs[0].job.company == 'GoodCo'
