# LinkedIn Profile Search — Persistent Resumable Search Run Design

Date: 2026-08-27
Branch: `feature/cv-library-3-slots`
Status: Approved for implementation

## Goal

Keep one user-visible **Search LinkedIn** action while replacing the single 300-second request with a resumable state machine:

**Create Search Run → exhaustive observable discovery → adaptive Full JD batches → existing evaluation → COMPLETE / ACCESS LIMITED**

The run must survive browser refresh/close in production and must never silently claim full coverage when LinkedIn blocks required public pages.

## Frozen behavior

Do not change Search relevance scoring, Search Profile semantics, Union Search Plan semantics, BUG #3 multilingual role confirmation, role thresholds, exclusions, CV selection/comparison/tailoring, or job statuses. `main` and deployment remain untouched unless separately authorized.

## Persistence model

Production persists Search Run state in Supabase with RLS ownership by `auth.uid()`:

- `search_runs`: run status, freshness window, immutable Search Profile snapshot, discovery cursor/state, stats, coverage, evaluation version, timestamps.
- `search_candidates`: one row per `(run_id, LinkedIn job_id)`, deduplicated candidate metadata, merged `foundBy`, detail status, parsed JD, evaluation, audit/error.

Preview uses the same state-machine contracts with a `sessionStorage` adapter because the existing preview auth bypass intentionally has no real Supabase user session. This keeps TEST safe without introducing a server secret or weakening RLS.

## Discovery state machine

For every Search Profile direction, pagination advances `start=0,25,50,75,100,...` with no predetermined ceiling.

A direction completes only on source-derived evidence:

1. empty page;
2. exact repeated page fingerprint / repeated job-ID sequence; or
3. two consecutive pages producing zero new job IDs.

A non-retryable/access failure marks that direction and the overall run `ACCESS LIMITED` rather than `COMPLETE`.

Each server invocation processes a bounded number of page requests and returns a checkpoint. Candidate IDs are merged globally; duplicate vacancies preserve all `foundBy` directions.

Completeness means **all observable results returned by LinkedIn's public endpoint during this run**, not all jobs that may exist internally on LinkedIn.

## Full JD processor

Full JD work is adaptive rather than a fixed mandatory batch size.

- maximum candidates per invocation: 30;
- stop earlier when the invocation approaches its safe time budget;
- preserve the existing stable fetcher pacing/retry behavior;
- checkpoint every processed candidate;
- candidate 31+ continues in the next invocation;
- failures are `UNVERIFIED` and contribute to `ACCESS LIMITED`; later candidates continue.

The JD processor reuses the existing profile evaluation functions. Scoring and BUG #3 behavior are not reimplemented.

## Idempotency

Every mutation is idempotent:

- candidate uniqueness is `(run_id, job_id)`;
- rediscovering a job only merges `foundBy`;
- a processed JD is not processed again unless explicitly reset;
- retrying the same discovery checkpoint cannot create duplicate jobs;
- run status transitions are monotonic except explicit cancellation/retry actions.

## API boundaries

- `POST /api/linkedin-profile-search/run` — create a run from the current Search Profile snapshot.
- `POST /api/linkedin-profile-search/discover` — execute the next bounded discovery chunk and checkpoint it.
- `POST /api/linkedin-profile-search/process` — process the next adaptive pending JD chunk and checkpoint results.
- `GET /api/linkedin-profile-search/run?id=...` — load/resume a production run.

Preview may carry/checkpoint run state client-side while calling the same discovery/process batch logic.

## UI

The user still clicks once. UI automatically advances the run and displays progress such as:

`Discovered 287 · Full JDs read 120 / 287`

Final states:

- `COMPLETE` — all observable discovery directions reached a source-derived end and all candidates were processed;
- `ACCESS LIMITED` — any required page/JD remained inaccessible or unverified;
- `FAILED` — orchestration cannot safely continue;
- `CANCELLED` — explicit user cancellation.

Refresh/return in production reloads the active run and continues from the persisted checkpoint.

## Security

All public Supabase tables have RLS enabled. Authenticated users may only select/insert/update/delete rows owned through their `search_runs.user_id = auth.uid()`. No service-role/secret key is exposed to the browser. Supabase clients are created per request.

## Versioning

Each run stores an evaluation version plus its Search Profile/Union Search Plan snapshot. Historical results therefore remain attributable to the rules used when the run was created.

## Acceptance criteria

1. Discovery reaches `start=75/100+` when unique rows continue.
2. No fixed pagination ceiling exists for 3/7/14 days.
3. Empty, exact repeat, or two consecutive no-new pages terminate a direction.
4. Duplicate job IDs merge while preserving all `foundBy` provenance.
5. More than 30 candidates are processed across multiple JD invocations without loss.
6. Adaptive time budget may return fewer than 30 and resumes cleanly.
7. Refresh/reload can resume a production run from Supabase.
8. Preview executes the same state machine using session persistence.
9. Any inaccessible discovery page or JD produces `ACCESS LIMITED`.
10. Existing scoring, Search Profile, BUG #3, role matching, exclusions and CV behavior remain unchanged.
11. No TEST deployment and no `main` changes occur without separate authorization.
