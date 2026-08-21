from pathlib import Path
from app.models import Job
from app.scoring import evaluate_job, load_profile

PROFILE = load_profile(Path(__file__).parent.parent / "config" / "yulia_profile.yaml")
RESUME = """
Senior IT delivery professional with project management, software delivery, enterprise software,
Azure, SQL, Power BI, banking, fintech, payments, post-trade, regulatory reporting, AML, compliance, systems integration, digital transformation, PMO, stakeholder management,
risk management, dependency management, budget, release, cutover, go-live, distributed teams,
international teams and governance experience.
"""


def make_job(**overrides):
    data = dict(
        source="test",
        source_job_id="1",
        company="Example Bank",
        title="Senior Delivery Manager",
        location="Copenhagen, Denmark",
        country="Denmark",
        remote_type="hybrid",
        employment_type="permanent",
        salary_min_dkk_month=76000,
        salary_max_dkk_month=80000,
        description=(
            "Lead enterprise software delivery across distributed engineering teams. Own scope, budget, risks, "
            "dependencies, milestones, release readiness, cutover and go-live. Senior stakeholder management "
            "for banking, fintech, payments, post-trade, regulatory reporting and compliance platforms using Azure, systems integration, digital transformation, PMO and data services."
        ),
        original_url="https://example.com/job/1",
    )
    data.update(overrides)
    return Job(**data)


def test_strong_fintech_delivery_fit():
    result = evaluate_job(make_job(), PROFILE, RESUME)
    assert result.verdict == "Strong fit"
    assert result.score >= 9.0
    assert not result.hard_exclusion


def test_hard_rnd_exclusion_even_when_title_contains_project_manager():
    job = make_job(
        title="Senior Project Manager, Drug Discovery",
        description="Lead scientific research programmes and laboratory development for drug discovery and new product R&D."
    )
    result = evaluate_job(job, PROFILE, RESUME)
    assert result.verdict == "Poor fit"
    assert result.hard_exclusion
    assert "R&D" in result.hard_exclusion_reason


def test_mandatory_danish_rejects():
    job = make_job(description=make_job().description + " Professional Danish is mandatory for this position.")
    result = evaluate_job(job, PROFILE, RESUME)
    assert result.hard_exclusion
    assert "Danish" in result.hard_exclusion_reason


def test_coordination_only_rejects():
    job = make_job(
        title="Project Coordinator",
        description="IT coordination, meeting management, facilitation and status reporting. No ownership of delivery outcomes."
    )
    result = evaluate_job(job, PROFILE, RESUME)
    assert result.hard_exclusion
