# Night Flight manual control — Solution Design v1.0

## Goal
Allow an authenticated user to start/resume Night Flight at any clock time and explicitly retry one FAILED Match from an existing run. Retain automatic cron's 02:00 Copenhagen gate unchanged.

## Interfaces
- `GET /api/night-flight-manual`: list the authenticated user's retained runs and minimal job summaries. Never return frozen CV/JD or raw model output.
- `POST /api/night-flight-manual`, JSON `{"mode":"start"}`: use the existing `runNightFlightForUser` (previous Copenhagen calendar day as of the request); resume its existing run or discover once. Existing READY jobs remain intact.
- `POST` `{"mode":"resume","runId":"<uuid>"}`: continue up to the existing three jobs in the selected owned run, without discovery.
- `POST` `{"mode":"retry","runId":"<uuid>","jobKey":"<key>"}`: compare-and-swap a single FAILED job to QUEUED (new attempt budget), then process only that job using its original frozen run CV/profile and JD snapshot. Reject READY, SKIPPED_AREA, QUEUED, RETRY or PROCESSING as retry targets.
- Dedicated `/night-flight-control` page displays mode controls and returned status; repeat Resume as needed. No CLI tokens or client-side service keys.

## Trust boundaries
Use the real Supabase authenticated session, then a service-role client only after verifying the requested run belongs to that exact user. Disable the write API on preview (legacy preview auth is synthetic). Reject cross-origin POST requests. All DB lookups scope by run ID + authenticated user. No client-supplied CV, JD, user ID or date. Only existing run snapshots are processed.

## Concurrency and idempotency
Existing DB compare-and-swap on job status and timestamp remains the authority for claims. Retry itself uses the same CAS pattern. If another worker claimed a job, no update and return a conflict. Normal queue still claims at most 3 jobs per request; explicit retry scopes claims to a single job. Never touch existing READY, applied history or cache. A repeat `start` for the same day resumes instead of duplicating discovery. This cannot guarantee atomic isolation across a race between retry and other concurrently running workers; mitigate through CAS and return informative status.

## Timeouts
No long-running loop of the entire queue in a single serverless invocation. One request consumes the existing maximum of three jobs; user can Resume again if unfinished. A serverless timeout may still interrupt work; retain existing PROCESSING lease logic and retry/resume semantics. Do not claim that HTTP 200 means all jobs completed.

## Acceptance
- No changes to automatic cron, prompts, AI model, expertise scoring, Match cache identity, Applied or area filtering.
- Before 02:00 manual start works for the last completed Copenhagen calendar day.
- Resume works by explicit retained run ID irrespective of date/time and does not rediscover.
- Retry only one FAILED job, preserving READY; diagnostics saved in existing last_error.
- Invalid, foreign or nonexistent run rejected; CSRF origin check; preview write denied.
- Unit, targeted, full regression and build green; verify TEST/LIVE schema compatibility. Preview write API is deliberately disabled due to synthetic preview identity, so end-to-end authenticated POST requires production session. Do not treat a green mocked test as a completed live AI run.
