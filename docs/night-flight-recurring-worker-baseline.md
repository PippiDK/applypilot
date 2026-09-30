# Night Flight recurring worker baseline

Production baseline: `f36e3d7cc9428aa7a344cd55be8000618216a9c1`.

Current behavior intentionally preserved before the worker patch:
- Night Flight durable queue persists jobs in Supabase.
- Match processing is bounded to 3 jobs per invocation.
- Existing queue retry/CAS/lease semantics stay unchanged.
- Existing discovery cron stays unchanged.
- Manual Control remains the operational fallback.

Patch goal: add only recurring orchestration that resumes persisted RUNNING runs in later short invocations.
