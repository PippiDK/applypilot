from pathlib import Path
from app.models import Job
from app.scoring import evaluate_job, load_profile

PROFILE = load_profile(Path(__file__).parent.parent / 'config' / 'yulia_profile.yaml')
RESUME = (
    'Senior IT delivery manager with enterprise software, systems integration, banking, fintech, payments, '
    'post-trade, regulatory reporting, Azure, SQL, data warehouse, stakeholder management, risk management, '
    'budget, dependency management, distributed teams, release, UAT, cutover, go-live and governance.'
)


def job(description: str, title: str = 'Senior IT Project Manager', location: str = 'Hørsholm 2970') -> Job:
    return Job(
        source='LinkedIn Jobs', source_job_id='1', company='Example', title=title, location=location, country='Danmark',
        description=description, full_jd_verified=True, original_url='https://dk.linkedin.com/jobs/view/test-4455000001'
    )


BASE = (
    'Lead enterprise software delivery and systems integration. Own scope, budget, risks, dependencies and milestones. '
    'Coordinate distributed engineering teams, senior stakeholders, release readiness, UAT, cutover and go-live. '
    'The platform uses Azure and data services with governance requirements. '
)


def test_danish_preferred_is_not_rejected():
    result = evaluate_job(job(BASE + 'English is required. Danish is preferred but not required.'), PROFILE, RESUME)
    assert result.hard_exclusion is False


def test_mandatory_danish_is_rejected():
    result = evaluate_job(job(BASE + 'Professional Danish is required for this role.'), PROFILE, RESUME)
    assert result.hard_exclusion is True
    assert 'Danish' in result.hard_exclusion_reason


def test_corporate_it_inside_rnd_company_is_not_rejected():
    text = BASE + (
        'This corporate IT platform supports scientific research and drug discovery teams. '
        'The project is an enterprise digital platform implementation, not product R&D.'
    )
    result = evaluate_job(job(text), PROFILE, RESUME)
    assert result.hard_exclusion is False


def test_primary_construction_project_is_rejected():
    text = (
        'Lead a building construction project and civil engineering workstreams. Own budget, risks, dependencies and milestones. '
        'Use digital project reporting tools and coordinate site contractors.'
    )
    result = evaluate_job(job(text, title='Senior Project Manager - Construction'), PROFILE, RESUME)
    assert result.hard_exclusion is True
    assert 'construction' in result.hard_exclusion_reason.lower()


def test_coordination_only_is_rejected_even_if_it_mentions_delivery_outcomes():
    text = 'IT coordination, facilitation, meeting management and status reporting. No ownership of delivery outcomes.'
    result = evaluate_job(job(text, title='Project Coordinator'), PROFILE, RESUME)
    assert result.hard_exclusion is True


def test_unverified_full_jd_is_rejected():
    j = job(BASE)
    j.full_jd_verified = False
    result = evaluate_job(j, PROFILE, RESUME)
    assert result.hard_exclusion is True
    assert 'Full Job Description' in result.hard_exclusion_reason


def test_remote_europe_without_denmark_confirmation_is_not_assumed_eligible():
    j = job(BASE + ' This is a fully remote role available across Europe.')
    j.remote_type = 'remote'
    j.remote_eligibility = 'UNVERIFIED'
    result = evaluate_job(j, PROFILE, RESUME)
    assert result.hard_exclusion is False
    assert 'REMOTE ELIGIBILITY — UNVERIFIED' in result.gaps


def test_remote_role_explicitly_excluding_denmark_is_rejected():
    j = job(BASE + ' This is a fully remote role. Employment is available only in Germany and France.')
    j.remote_type = 'remote'
    j.remote_eligibility = 'DENMARK EXCLUDED'
    result = evaluate_job(j, PROFILE, RESUME)
    assert result.hard_exclusion is True
    assert 'Denmark' in result.hard_exclusion_reason
