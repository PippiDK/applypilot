# Night Flight Task 6 — Durable Match Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Night Flight Match processing resumable, idempotent and failure-isolated using the existing `night_flight_runs` / `night_flight_jobs` schema.

**Architecture:** Add one focused queue module that claims one persisted job at a time with compare-and-set semantics, uses `updated_at` as the PROCESSING lease timestamp, bounds retries, and reconciles run status from persisted job states. Keep Match calculation injected as a callback so Task 6 changes no Match logic; Task 8 will plug in the shared Match cache/engine. Make Task 5 run creation idempotent by returning the existing user/date run unchanged instead of creating a second batch.

**Tech Stack:** Next.js / Node ESM, node:test, Supabase JS query builder, existing Night Flight tables.

**Spec:** `ApplyPilot_V18_Night_Flight_Solution_Specification(2).docx`

## Global Constraints

- READY jobs are terminal and must never be recalculated on resume.
- Abandoned PROCESSING jobs become reclaimable only after a safe lease timeout.
- Retries are bounded; exhausted jobs become FAILED and other jobs continue.
- Repeated invocation for the same user/target date resumes the same run.
- Job states remain exactly `QUEUED / PROCESSING / READY / RETRY / FAILED / SKIPPED_AREA`.
- Run states remain exactly `PENDING / RUNNING / READY / READY_WITH_ERRORS / NO_JOBS / FAILED`.
- Match algorithm/cache implementation is out of scope until Task 8.
- Scheduler is out of scope until Task 7.
- Manual Search is unchanged.

---

### Task 1: RED queue contracts

**Files:**
- Create: `app/lib/night-flight-match-queue.test.mjs`

**Interfaces:**
- Produces contract for `claimNextNightFlightJob`, `completeNightFlightJob`, `failNightFlightJob`, `processNightFlightQueue`, and `reconcileNightFlightRun`.

- [ ] Write failing tests proving: READY/SKIPPED_AREA/FAILED are never claimed; QUEUED/RETRY are claimed with attempts incremented; fresh PROCESSING is leased while stale PROCESSING is reclaimable; success becomes READY; failure becomes RETRY until budget is exhausted then FAILED; one failed vacancy does not stop later vacancies; resume skips READY work; final run becomes READY or READY_WITH_ERRORS.
- [ ] Run CI and verify the new tests fail because `night-flight-match-queue.js` does not exist while all pre-existing tests remain green.

### Task 2: Minimal durable queue implementation

**Files:**
- Create: `app/lib/night-flight-match-queue.js`

**Interfaces:**
- `claimNextNightFlightJob({supabase,runId,now,leaseMs,maxAttempts})` returns one claimed row or `null`.
- `completeNightFlightJob({supabase,claimedJob,matchCacheKey,now})` persists `READY` using the claim timestamp as a CAS token.
- `failNightFlightJob({supabase,claimedJob,error,maxAttempts,now})` persists `RETRY` or `FAILED` using the same CAS token.
- `reconcileNightFlightRun({supabase,runId,now})` updates persisted counters and run status.
- `processNightFlightQueue({supabase,runId,processJob,now,maxAttempts,leaseMs,maxJobs})` repeatedly claims durable work, catches per-job failures, continues, then reconciles the run.

- [ ] Implement claims from only `QUEUED`, `RETRY`, or stale `PROCESSING`; increment attempts on every claim.
- [ ] Use conditional update on `run_id + job_key + previous status + previous updated_at` so only one worker wins a claim/reclaim.
- [ ] Keep retries configurable with a conservative default of 3 attempts and PROCESSING lease configurable with a default of 15 minutes.
- [ ] Keep `processJob` injected; Task 6 must not import or call the Match engine.
- [ ] Run focused tests until GREEN.

### Task 3: Same-night run idempotency

**Files:**
- Modify: `app/lib/night-flight-area-scope.js`
- Modify: `app/lib/night-flight-area-scope.test.mjs`

**Interfaces:**
- `persistNightFlightAreaScope({supabase,userId,batch})` first checks `night_flight_runs` by `user_id + target_date`; if present it returns that run and does not insert/reset jobs.

- [ ] Add RED test proving a second invocation for the same user/date returns the existing run and performs no run/job insert.
- [ ] Implement the minimal existing-run lookup before Task 5 insert logic.
- [ ] Verify Task 5 tests remain GREEN.

### Task 4: Regression gate

**Files:**
- No product changes unless verification exposes a Task 6 defect.

- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Compare Task 6 branch to Task 5 head and confirm only queue/tests, the tiny Task 5 idempotency adjustment, and this plan changed.
