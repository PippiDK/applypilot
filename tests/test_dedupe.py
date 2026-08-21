from app.dedupe import deduplicate
from app.models import Job


def job(source, description, official=None):
    return Job(
        source=source,
        source_job_id=source,
        company="Acme",
        title="Senior IT Project Manager",
        location="Hørsholm",
        description=description,
        original_url=f"https://{source.lower()}.example/job",
        official_url=official,
    )


def test_dedupe_prefers_official_and_fuller_description():
    a = job("Board", "short " * 20)
    b = job("Other", "full description " * 30, "https://acme.example/careers/1")
    result = deduplicate([a, b])
    assert len(result) == 1
    assert str(result[0].official_url).startswith("https://acme.example")
