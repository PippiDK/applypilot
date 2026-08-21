from pathlib import Path
from app.dedupe import deduplicate
from app.history import SearchHistory
from app.models import Job


def make(source_id: str, deadline=None, location='Hørsholm 2970'):
    return Job(
        source='LinkedIn Jobs', source_job_id=source_id, company='SameCo', title='Senior IT Project Manager',
        location=location, country='Danmark', description='Enterprise software delivery ' * 30,
        full_jd_verified=True, original_url=f'https://dk.linkedin.com/jobs/view/test-{source_id}', deadline=deadline
    )


def test_same_company_title_but_different_linkedin_ids_are_not_merged():
    assert len(deduplicate([make('1'), make('2')])) == 2


def test_same_source_id_is_deduplicated():
    assert len(deduplicate([make('1'), make('1')])) == 1


def test_deadline_change_is_updated(tmp_path):
    history = SearchHistory(tmp_path / 'history.json')
    first = make('1', '2026-09-01T00:00:00Z')
    assert history.classify(first) == 'NEW'
    history.remember([first])
    same = make('1', '2026-09-01T00:00:00Z')
    assert history.classify(same) == 'SEEN'
    changed = make('1', '2026-09-10T00:00:00Z')
    assert history.classify(changed) == 'UPDATED'
