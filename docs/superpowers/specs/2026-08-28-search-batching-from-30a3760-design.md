# Search batching from 30a3760 — design

Date: 2026-08-28

## Goal

Use commit `30a37606bc5b2c29437333ba154a8547eaa626db` as the exact whole-product baseline and add only one capability: resumable batching so a large LinkedIn search can continue reading and evaluating candidates until the discovered set is exhausted, instead of stopping when one long request reaches its retry/time budget.

The implementation branch is created directly from `30a3760`. No later product behavior is retained by default. Later code may be copied only when it is strictly required to implement the batching transport described in this spec; later Search evaluation, UI behavior, language fixes and unrelated features must not be transplanted.

The live control run on `30a3760` proved the target behavior:

- 1 day: 103 discovered / 103 Full JDs read / SEARCHED.
- 7 days: 212 discovered / 107 Full JDs read / ACCESS LIMITED.

The intended change is infrastructure only. Search intelligence and KEEP/REJECT behavior must remain the `30a3760` behavior.

## In scope

1. Start from the exact `30a3760` whole-product tree.
2. Split large profile-driven LinkedIn Search into resumable phases:
   - discovery/pagination;
   - persisted candidate queue;
   - bounded Full JD processing batches;
   - checkpoint after each batch;
   - resume until no pending candidates remain.
3. Preserve candidate provenance (`foundBy`) and the Search Profile behavior that exists in `30a3760`.
4. Reuse only the proven Search Run transport pattern from the later implementation where it reduces risk, adapting it to the `30a3760` evaluator instead of importing later evaluation logic or unrelated product changes.
5. Keep Full JD retrieval failures isolated: one inaccessible JD becomes `UNVERIFIED` and must not stop later candidates.
6. Keep processing bounded per server invocation. Initial target: up to 30 candidates per processing invocation, subject to the existing safe time budget.
7. Preserve the `30a3760` user-facing Search behavior, adding only the progress/resume wiring strictly necessary for batching.
8. No OpenAI/LLM call is introduced by this feature.

## Explicitly out of scope

This task must NOT add or change, relative to the `30a3760` baseline:

- BUG3 Danish-language normalization/fix;
- semantic/LLM Search evaluation;
- BUG4 Delivery Domain;
- `TARGET_TECH`;
- physical/functional domain rules;
- mandatory Role Family taxonomy;
- HOLD logic;
- new exclusions or filters;
- Search Profile generation;
- Primary/Adjacent role generation;
- geography behavior;
- work-model filtering;
- Best CV / Expertise Match / right-panel / tailoring behavior;
- scoring thresholds or KEEP/REJECT semantics;
- the old cosmetic `worthwhile after evaluation` counter wording/meaning;
- `main`;
- deployment.

## Required architecture

### Discovery

Discovery continues using the saved Search Profile directions and the `30a3760` discovery semantics. Pagination may run over multiple server invocations if needed. Candidates are deduplicated by stable LinkedIn vacancy identity while preserving all `foundBy` directions.

### Persistent Search Run

A Search Run owns the state for one user-triggered search. It persists:

- run id / owner;
- freshness window;
- Search Profile snapshot or version needed to evaluate consistently;
- discovery cursor/state;
- discovered candidate count;
- candidate queue and processing state;
- final run status.

Candidate processing states remain transport states, not relevance decisions: `PENDING`, `PROCESSING`, `PROCESSED`, `UNVERIFIED` (or the equivalent existing persisted names if the transplanted transport implementation already defines them).

### Full JD processing

Each process invocation:

1. claims the next bounded set of pending candidates;
2. retrieves each Full JD;
3. runs the exact `30a3760` Search evaluation logic against its `foundBy` Search Profile direction(s);
4. stores KEEP/REJECT/audit output;
5. marks inaccessible Full JDs `UNVERIFIED` without aborting the batch;
6. saves progress;
7. returns whether more pending work remains.

The browser/client continues invoking processing until the run is complete or genuinely blocked by source access.

### Evaluation boundary

The evaluation algorithm itself must not be redesigned. The implementation may extract or wrap the `30a3760` evaluator so it can be called from the batch processor, but output for the same job + Full JD + `foundBy` input must remain equivalent to `30a3760`.

## Keys, cost and performance

- No OpenAI key is used by Search batching.
- No LLM token cost is introduced.
- Existing Supabase/Vercel credentials are reused; no new user-facing key is required.
- Per-vacancy evaluation cost should stay approximately the same as `30a3760` because evaluation remains local code.
- A 7-day run may take longer wall-clock time than the old interrupted run because it will actually process the candidates that previously remained unread. The feature must avoid one giant request and instead trade one long timeout-prone request for multiple bounded resumable requests.

## Failure behavior

- One JD fetch failure does not fail the run.
- A server invocation failure leaves unprocessed candidates resumable.
- A refresh/retry must not duplicate already processed work.
- Source-level blocking may finish as an access-limited run, but only after all candidates that can be processed under the run policy have been attempted; it must not stop merely because one invocation exhausted its local budget.

## Verification

The implementation is accepted only if all of the following hold:

1. Regression fixtures prove the `30a3760` evaluator produces unchanged KEEP/REJECT decisions before and after batching integration.
2. A batch test proves more candidates than one invocation can hold are processed across multiple invocations without duplication.
3. A resume test proves an interrupted run continues from persisted state.
4. A failure test proves one Full JD fetch failure becomes `UNVERIFIED` and later candidates are still processed.
5. A 30+ candidate test proves the invocation cap/checkpoint behavior.
6. Diff against `30a3760` contains only batching/resume infrastructure, its minimal wiring, tests, migration/config strictly required for persistence, and this documentation. No unrelated later product files are restored.
7. Search Profile generation, BUG3, geography and right-panel behavior remain the `30a3760` versions.
8. Build and relevant/full tests run before any deployment.
9. Live acceptance test on a separate Preview uses the same Search Profile and 7-day window and checks that the run goes materially beyond the previous 107/212 boundary, ideally processing all readable candidates.

## Deployment boundary

No deployment is part of implementation. After tests are green, deployment requires a separate explicit user command.
