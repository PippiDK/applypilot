from app.sources.thehub import TheHubSource
from app.scoring import _hits


def test_thehub_row_parser_accepts_full_jd():
    source = TheHubSource()
    row = {
        "id": "abc",
        "title": "Technical Project Manager",
        "company": {"name": "StartupCo"},
        "location": {"city": "Copenhagen", "country": "Denmark"},
        "description": "Lead software implementation, engineering dependencies, risks, milestones and delivery outcomes. " * 3,
        "url": "https://thehub.io/jobs/abc",
    }
    job = source._to_job(row)
    assert job is not None
    assert job.company == "StartupCo"
    assert "Technical Project Manager" == job.title


def test_short_it_signal_uses_token_boundary():
    assert _hits("Lead IT delivery", ["IT"]) == ["IT"]
    assert _hits("Ability to communicate", ["IT"]) == []
