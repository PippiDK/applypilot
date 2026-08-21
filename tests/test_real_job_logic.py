from datetime import datetime, timezone
from pathlib import Path

from app.models import Job
from app.scoring import evaluate_job, load_profile
from app.sources.linkedin import LinkedInPublicSource

PROFILE = load_profile(Path(__file__).parent.parent / "config" / "yulia_profile.yaml")
RESUME = """
Senior IT Project and Delivery Manager with end-to-end enterprise software and platform delivery across global organisations.
Owned scope, budget, schedule, governance, risks and dependencies; executive reporting and senior stakeholder management.
Led distributed teams in Denmark, India and Poland. Systems integration, infrastructure, data platforms, Azure, SQL, DWH, BI,
Agile, Hybrid, SAFe and Scrum. Release readiness, SIT, UAT, cutover, go-live, hypercare and operational handover.
Financial IT background from banking and post-trade covering AML, regulatory reporting, compliance, fee and tax automation,
platform stability, data and reporting. PMO practices, roadmap governance and complex cross-functional delivery.
"""


def make(title: str, company: str, location: str, description: str, **kwargs) -> Job:
    return Job(
        source="LinkedIn Jobs",
        source_job_id=f"{company}-{title}",
        company=company,
        title=title,
        location=location,
        country="Denmark",
        description=description,
        full_jd_verified=True,
        original_url="https://dk.linkedin.com/jobs/view/test-4455000001",
        **kwargs,
    )


def test_velux_software_execution_lead_is_not_undervalued():
    jd = """
    Drive end-to-end execution of strategic software initiatives across agile teams. Manage dependencies, resources and risks
    to deliver predictable outcomes. Translate business strategy into roadmaps, priorities and measurable outcomes. Build
    alignment across business, Product Owners, Solution Architects and engineering teams. Establish governance, monitor progress,
    remove roadblocks and ensure delivery on time and within scope. The role sits in a software development environment and works
    with distributed development teams, senior stakeholders and technical implementation.
    """
    r = evaluate_job(make("Software Execution Lead", "VELUX", "Hørsholm, Denmark", jd), PROFILE, RESUME)
    assert not r.hard_exclusion
    assert r.score >= 7.5


def test_simcorp_program_role_scores_as_plausible_fit():
    jd = """
    Fintech investment-management software company. Own a portfolio of cross-functional programs spanning AI execution,
    engineering tooling, compliance and platform migration. Full accountability for outcomes, milestones, risks and stakeholder
    communication. Establish program governance, owners, dependencies, escalation paths and senior leadership reporting.
    Coordinate Product Management, Platform and Application Engineering to resolve dependencies and keep delivery on track.
    Employees spend part of the week in the office and may work remotely the other days.
    """
    j = make("Senior Principal Program Manager", "SimCorp", "Copenhagen, Denmark", jd)
    j.remote_type = LinkedInPublicSource._remote_type(j.location, jd)
    r = evaluate_job(j, PROFILE, RESUME)
    assert not r.hard_exclusion
    assert r.score >= 7.5


def test_saxo_foundation_pmo_scores_high_from_real_delivery_language():
    jd = """
    Financial services Group PMO role leading strategic transformation across automation, regulatory infrastructure and platform
    domains. Lead end-to-end project delivery and own the full lifecycle of complex cross-functional initiatives. Manage scope,
    timelines, budgets, resources, risks and dependencies across business and technology teams. Establish governance, SteerCo
    reporting, decision frameworks and measurable outcomes. Experience with data, platforms, APIs and regulated environments is valued.
    """
    r = evaluate_job(make("Senior Project Manager to Group PMO (Foundation Portfolio)", "Saxo", "Copenhagen, Denmark", jd), PROFILE, RESUME)
    assert not r.hard_exclusion
    assert r.score >= 7.5


def test_saxo_risk_compliance_is_not_hard_rejected_merely_for_missing_it_keyword():
    jd = """
    Financial-services Group PMO role. Take end-to-end ownership of complex cross-functional Risk and Compliance projects.
    Lead and deliver high-impact regulatory, compliance and risk initiatives. Own project governance, planning, risks and reporting,
    drive stakeholder alignment, translate regulatory challenges into actionable plans and tangible outcomes, and maintain delivery momentum.
    """
    r = evaluate_job(make("Senior Project Manager, Risk & Compliance Portfolio in Group PMO", "Saxo", "Copenhagen, Denmark", jd), PROFILE, RESUME)
    assert not r.hard_exclusion
    assert r.score >= 6.0
    assert any("Technology/digital scope is not explicit" in gap for gap in r.gaps)


def test_ambu_global_it_pmo_is_plausible():
    jd = """
    Senior IT Project Manager in a global IT PMO. Take accountability from project initiation to closure and drive execution of
    high business-impact initiatives with significant IT complexity. Lead cross-functional delivery, project planning, milestones,
    governance, risks, dependencies and senior stakeholder communication across global functions and corporate systems.
    """
    r = evaluate_job(make("Senior IT Project Manager", "Ambu", "Ballerup, Denmark", jd), PROFILE, RESUME)
    assert not r.hard_exclusion
    assert r.score >= 7.0


def test_hcl_program_role_gets_people_management_penalty_not_false_onsite_penalty():
    jd = """
    Global technology Program Manager accountable for scope, effort, budget and delivery of large transformation and migration
    programs. Manage a team of project managers, hiring and retaining talent, performance management and resource utilization.
    Own contractual milestones, stakeholder reporting and risk. Infrastructure transformation, tools implementation and systems
    integration. Experience of global delivery with an offshore/onsite delivery model.
    """
    r = evaluate_job(make("Program Manager", "HCLTech", "Copenhagen, Denmark", jd), PROFILE, RESUME)
    assert not r.hard_exclusion
    assert any("people-management" in gap for gap in r.gaps)
    assert LinkedInPublicSource._remote_type("Copenhagen, Denmark", jd) == "unknown"


def test_workday_mandatory_danish_still_hard_rejects():
    jd = """
    Lead enterprise Workday implementations through deployment lifecycle, scope and risk management, project budget and forecast,
    team management and go-live. 7+ years of project management. Fluency in English and Danish is mandatory.
    """
    r = evaluate_job(make("Senior Project Manager", "Workday", "Copenhagen, Denmark", jd), PROFILE, RESUME)
    assert r.hard_exclusion
    assert "Danish" in r.hard_exclusion_reason


def test_rnd_computer_vision_is_rejected():
    jd = """
    Join a product-development area of computer vision and software professionals. Keep the technical roadmap and project
    dependencies on track while collaborating with Product Management on new 3D reconstruction capabilities and computer-vision development.
    """
    r = evaluate_job(make("Technical Project Manager within Computer Vision", "3Shape", "Copenhagen, Denmark", jd), PROFILE, RESUME)
    assert r.hard_exclusion
    assert "R&D" in r.hard_exclusion_reason


def test_hybrid_methodology_is_not_work_model():
    jd = "Familiarity with Agile, Waterfall, or hybrid delivery approaches. Lead IT transformation projects."
    assert LinkedInPublicSource._remote_type("Copenhagen, Denmark", jd) == "unknown"


def test_actual_flexible_office_language_is_hybrid():
    jd = "Our flexible work model combines in-person and remote work. We spend at least half (50%) of our time each quarter in the office."
    assert LinkedInPublicSource._remote_type("Copenhagen, Denmark", jd) == "hybrid"


def test_explicit_application_deadline_is_parsed_and_can_close_job():
    deadline = LinkedInPublicSource._deadline("Deadline for application: 20th August 2026", 2026)
    assert deadline == datetime(2026, 8, 20, 23, 59, 59, tzinfo=timezone.utc)
    j = make("IT Project Manager", "3Shape", "Copenhagen, Denmark", "Lead end-to-end IT project delivery with budget, risks and dependencies.", vacancy_status="CLOSED")
    r = evaluate_job(j, PROFILE, RESUME)
    assert r.hard_exclusion
    assert "closed" in r.hard_exclusion_reason.lower()


def test_monthly_salary_parser_is_conservative():
    assert LinkedInPublicSource._salary_monthly_dkk("Salary: 50,000–75,000 DKK per month") == (50000, 75000)
    assert LinkedInPublicSource._salary_monthly_dkk("Grundlønsniveau 50.000,00 kr./md - 75.000,00 kr./md") == (50000, 75000)
    assert LinkedInPublicSource._salary_monthly_dkk("Annual base salary: 647,000–971,000 DKK") == (None, None)
