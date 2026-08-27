# LinkedIn Profile Search — Exhaustive Batched Pipeline Design

Date: 2026-08-27
Branch: `feature/cv-library-3-slots`
Status: Approved in chat; written design pending user review before implementation

## Problem

The profile-driven LinkedIn search currently attempts discovery and Full JD retrieval inside one server request.

Two independent ceilings prevent complete 3/7/14-day coverage:

1. The stable LinkedIn fetcher has one shared time budget for the whole request while pacing requests conservatively. Discovery and Full JD reads compete for the same budget.
2. Discovery uses fixed `start` values, so pagination stops at predetermined offsets instead of continuing until LinkedIn itself reaches the end of accessible results.

This causes large searches to return partial output: discovery may find many jobs, but later Full JD reads fail once the shared request budget is exhausted. The application can therefore silently miss otherwise valid matches.

## Goal

Keep the user interaction as one Search action while changing the internal execution model to:

**Discovery → all accessible pages → Full JD batches → evaluation → one accumulated result**

The search must process all jobs that are accessible through LinkedIn's public endpoints during that run, subject only to explicit LinkedIn access failures. Access failures must be visible as `ACCESS LIMITED`; they must not be silently treated as a complete search.

## Non-goals / frozen behavior

This change must not alter:

- Search relevance scoring
- Search Profile semantics
- Union Search Plan semantics
- BUG #3 multilingual role-confirmation behavior
- Role matching rules or thresholds
- Exclusion rules
- CV selection, CV comparison, or CV tailoring logic
- Existing job status behavior
- `main`

The change is transport/orchestration only.

## Architecture

### 1. Client-orchestrated resumable search

The browser remains responsible for a single user-visible Search action, but internally performs multiple authenticated API calls.

The UI owns the temporary run state while the search is active:

- discovered candidates keyed by LinkedIn job ID
- per-candidate `foundBy` Search Profile directions
- discovery progress
- Full JD progress
- accumulated audit rows
- accumulated kept jobs
- access-limit diagnostics

No persistent database is required for this step.

### 2. Resumable discovery batches

Add a profile discovery batch API that accepts the current discovery cursor and returns the next bounded amount of work.

Conceptual request:

```json
{
  "freshnessDays": 7,
  "unionSearchPlan": { "directions": [] },
  "cursor": { ... }
}
```

Conceptual response:

```json
{
  "candidates": [],
  "cursor": { ... },
  "complete": false,
  "stats": { ... },
  "coverage": { ... }
}
```

The cursor records enough state to resume without repeating already-completed pagination work, including the current direction and next `start` offset.

Pagination for each Search Profile direction advances:

`0 → 25 → 50 → 75 → 100 → ...`

There is no fixed 25/50/75 ceiling.

A direction stops only when one of these evidence-based terminal conditions occurs:

- LinkedIn returns an empty page;
- LinkedIn repeats a page already seen for that direction (page fingerprint / repeated job-ID sequence);
- LinkedIn returns an explicit non-retryable access failure for that page, in which case coverage is marked `ACCESS LIMITED` and the failure is retained in diagnostics.

A batch processes only a bounded number of LinkedIn search-page requests so each server invocation remains comfortably below the route/fetcher budget. If more work remains, the response returns `complete:false` plus the next cursor and the browser immediately requests the next batch.

### 3. Candidate accumulation and deduplication

The browser merges discovery results by LinkedIn job ID.

If the same vacancy is discovered by multiple role directions, it remains one candidate and its `foundBy` directions are merged exactly as today.

Discovery progress can be presented as, for example:

`Discovered 287 jobs · searching all available pages…`

The user does not need to click again.

### 4. Full JD batches

After discovery completes, the client submits discovered candidates to a Full JD/evaluation batch API in bounded slices.

Default target batch size: **32 candidates**.

The batch size is an implementation constant, not a user setting. It can be tuned later without changing product semantics.

Each batch:

1. retrieves Full JD for each supplied candidate using the existing stable LinkedIn fetcher;
2. parses the JD with existing parsing logic;
3. runs the existing freshness, exclusion, role-confirmation, and Search Profile evaluation logic unchanged;
4. returns kept jobs plus audit rows and diagnostics for that slice.

Each Full JD batch gets a fresh fetcher/request budget, eliminating the current single-request exhaustion problem.

The browser accumulates all slice results into one logical search result.

Progress can be displayed as:

`Discovered 287 · Full JDs read 120 / 287`

### 5. Search completion semantics

A run is `SEARCHED` only when:

- discovery reached an evidence-based terminal condition for every role direction; and
- every discovered candidate was either fully processed or explicitly classified as inaccessible/unverified.

A run is `ACCESS LIMITED` when any required public LinkedIn page or Full JD cannot be retrieved after the existing retry policy.

`ACCESS LIMITED` is not treated as zero relevance and does not silently imply complete source coverage.

The final accumulated result still exposes the existing jobs/audit/stats shapes as far as possible so current UI consumers do not need scoring or job-card changes.

### 6. Retry and rate-limit behavior

Keep the existing conservative stable-fetcher behavior inside each API invocation.

Do not solve this problem by aggressively increasing concurrency or reducing pacing. The design prefers additional safe server calls over higher pressure on LinkedIn public endpoints.

A failed batch may be retried by the orchestration layer only where doing so preserves the existing retry/access semantics. Permanent failure must remain visible as `ACCESS LIMITED`.

## API / module boundaries

Implementation should preserve existing pure logic and separate orchestration from evaluation.

Expected additions/changes:

- new resumable discovery-batch module and API route;
- new Full JD/evaluation-batch module and API route;
- small client orchestration helper for the multi-call search run;
- `app/page.js` search action updated to consume progress and accumulate final results;
- existing `linkedin-profile-search.js` evaluation logic reused/extracted rather than rewritten;
- `linkedin-profile-discovery.js` pagination logic reused/extracted where possible, with fixed-page planning removed from the live profile-driven path;
- `linkedin-stable-fetcher.js` behavior unchanged unless a test proves a transport-only hook is required.

The old single-request profile route may remain temporarily for compatibility/tests, but the live UI should use the batched path once verified.

## Testing strategy

TDD is required.

### Discovery regression tests

Prove that:

- pages advance beyond `start=50`;
- a 3-day search can reach `start=75/100+` when LinkedIn keeps returning unique rows;
- a 7-day and 14-day search have no predetermined pagination ceiling;
- empty page terminates a direction;
- repeated page fingerprint terminates a direction without an infinite loop;
- duplicates across pages/directions merge by job ID while preserving `foundBy` provenance;
- access failure is reported as `ACCESS LIMITED`, not as successful complete coverage.

### Full JD batch tests

Prove that:

- more candidates than one batch size are processed across multiple batches;
- candidate 33+ is not lost when batch size is 32;
- results and audit rows from all batches are accumulated;
- a failed JD is visible as unverified/access-limited while later candidates still run in later batches;
- existing profile evaluation output for the same JD remains unchanged.

### Frozen-logic regression tests

Re-run existing tests covering:

- Search Profile / Union Search Plan;
- multilingual BUG #3 cases: Atea, PET, Regionshospitalet keep; Energinet reject;
- existing scoring/evaluation contracts;
- CV-related contracts relevant to search wiring.

### Build verification

Run targeted new tests, relevant existing regression tests, full repository test suite with known unrelated legacy UI failures reported separately if still present, and `npm run build` on the same Node version used for current verification.

## Rollout safety

Implementation is only on `feature/cv-library-3-slots`.

`vercel.json` deployment gate remains closed during development.

No TEST deployment occurs without explicit user authorization.

`main` remains untouched.

## Acceptance criteria

The change is accepted when all of the following are demonstrated:

1. Discovery can paginate beyond all previous fixed offsets and stops only on source-derived terminal evidence or explicit access failure.
2. A simulated candidate set larger than one Full JD batch is completely processed across multiple API calls.
3. The final UI result is the union of all completed batches with no candidate loss at batch boundaries.
4. Progress reports discovered count and Full JD processed count during the run.
5. `ACCESS LIMITED` is shown whenever source coverage is incomplete.
6. Existing Search relevance/scoring, Search Profile, role matching, BUG #3 behavior, and CV logic are unchanged.
7. No deployment and no `main` changes occur as part of implementation unless separately authorized.
