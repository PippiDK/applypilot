# ApplyPilot MVP v0.3 — LinkedIn Public Search E2E

This build intentionally has **one active source only: LinkedIn Jobs public pages**.

## End-to-end contract

`LinkedIn public search → public job detail page → verified full JD → normalize → dedupe → Master Prompt hard filters → JD/CV evidence scoring → ranked worthwhile jobs`

No Jobnet, CVR, company discovery, The Hub, Remote OK, We Work Remotely, or other connectors are active in this milestone.
Do not add a second source until this path is stable in production.

## Public LinkedIn flow

For every configured discovery query the connector requests LinkedIn's zero-login public search page for:

- `location=Denmark`
- freshness window via `f_TPR`

It extracts public `/jobs/view/...` links and their LinkedIn job IDs, deduplicates IDs, then opens each public job detail page.

A job is allowed into the evaluator **only** when the actual public detail page contains LinkedIn's full job-description container (`show-more-less-html__markup`) and the extracted JD passes a minimum body sanity check. Search-card snippets and meta descriptions are never treated as full JDs.

If LinkedIn returns an auth wall/challenge, if all search requests fail, or if search results exist but full JDs cannot be verified, coverage becomes `ACCESS LIMITED`. The engine never converts source failure into a fake successful zero-result search.

## Evaluator rules carried forward

The evaluator uses the Master Prompt weights:

- 40% actual responsibilities / delivery ownership
- 25% experience & domain evidence against supplied Master CV
- 20% geography / work model
- 15% career / compensation

Critical hard-filter regressions are covered by tests:

- Danish preferred but not required → not rejected
- mandatory professional/fluent Danish → rejected
- corporate IT inside an R&D-heavy company → not rejected merely because the JD mentions research/drug discovery
- primary construction/building/civil-engineering delivery → rejected
- coordination-only / no delivery ownership → rejected
- unverified full JD → rejected
- remote Europe without explicit Denmark support → `REMOTE ELIGIBILITY — UNVERIFIED`
- remote employment explicitly excluding Denmark → rejected

Salary ranges are assessed conservatively from the lower bound when a range is supplied; the upper bound is not treated as guaranteed compensation.

## API

### Health

`GET /health`

### Search

`POST /search`

Example body:

```json
{
  "resume_text": "<full Master CV text>",
  "freshness_days": 7,
  "max_results": 10,
  "only_new_or_updated": false
}
```

### Evaluate one already-normalized vacancy

`POST /evaluate`

## Tests

Run:

```bash
python -m pytest -q
```

The test suite includes a mocked **LinkedIn public search → public detail page → full JD → evaluator** integration test, parser tests, access-wall handling, hard-filter regressions, dedupe, and history updates.

The build environment used to assemble this package has no external DNS, so the exact HTTP path cannot be smoke-tested from this container against LinkedIn itself. Public LinkedIn search and job-detail pages were independently confirmed to be publicly readable on the web on 2026-08-21. The next production validation should therefore be exactly one thing: deploy this build and inspect the first real LinkedIn `/search` run. No second source should be added before that succeeds.
