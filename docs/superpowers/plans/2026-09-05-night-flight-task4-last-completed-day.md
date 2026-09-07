# Night Flight Task 4 — Last Completed Day Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-owned Night Flight discovery function that loads the latest saved profile/settings, searches only selected official sources, keeps only the exact previous Copenhagen calendar day, merges/deduplicates results, and returns a frozen discovery batch without changing Manual Search.

**Architecture:** Add one focused Night Flight discovery orchestrator in `app/lib`. Reuse the existing Copenhagen `Previous Day` freshness filter and the existing LinkedIn/Jobindex/Jobnet search adapters/evaluation logic; inject source runners in tests so Task 4 can be verified without live network calls. Do not add area filtering, Match processing, queueing, scheduler logic, or UI changes — those belong to later tasks.

**Tech Stack:** Next.js / Node ESM, node:test, existing ApplyPilot source adapters and profile evaluation, Supabase-backed Night Flight profile/settings stores.

**Spec:** `ApplyPilot_V18_Night_Flight_Solution_Specification(2).docx`

## Global Constraints

- Night Flight uses exact Last Completed Day in `Europe/Copenhagen`.
- Each run loads the latest server-side Search Profile state before discovery.
- Only user-selected sources among LinkedIn / Jobindex / Jobnet are called.
- Fresh discovery is performed every run; browser search results are not reused.
- Results are merged and deduplicated into one logical vacancy list.
- Manual Search remains unchanged.
- Area filtering / `SKIPPED_AREA` is Task 5, not Task 4.
- Durable queue/retry/resume is Task 6, not Task 4.

---

### Task 1: RED tests for the Task 4 contract

**Files:**
- Create: `app/lib/night-flight-last-completed-day.test.mjs`

**Interfaces:**
- Produces contract for `lastCompletedCopenhagenDate(now)`.
- Produces contract for `mergeNightFlightDiscovery(results)`.
- Produces contract for `runNightFlightLastCompletedDayDiscovery({supabase,userId,now,sourceRunners})`.

- [ ] Write tests proving Copenhagen previous-day calculation, selected-source-only execution, fresh execution on every invocation, exact Previous Day filtering, merge/dedupe, frozen snapshot semantics, and zero-source rejection.
- [ ] Run the focused test and verify RED because implementation does not exist.

### Task 2: Minimal Task 4 implementation

**Files:**
- Create: `app/lib/night-flight-last-completed-day.js`

**Interfaces:**
- Consumes `loadLatestNightFlightProfileState`, `loadNightFlightSettings`, `filterItemsByFreshnessSelection`.
- Accepts injectable `sourceRunners` to keep orchestration testable and to avoid duplicating source implementations.
- Returns `{targetDate, profileFingerprint, sourcesSnapshot, areasSnapshot, jobs, sourceResults, frozenAt}`.

- [ ] Implement exact previous Copenhagen date by reusing the same freshness/date semantics as Manual `Previous Day`.
- [ ] Load latest server profile and current saved settings at invocation time; reject missing profile or empty selected sources.
- [ ] Call only selected runners on every invocation with the current profile/search plan and a discovery window sufficient for `Previous Day`.
- [ ] Apply `filterItemsByFreshnessSelection(..., 'yesterday', now)` to every source result.
- [ ] Merge/dedupe by stable source identity first, then conservative same-vacancy fallback identity; preserve source records/provenance without mutating input objects.
- [ ] Freeze the returned batch object/arrays to prevent mid-run mutation.
- [ ] Run focused tests until GREEN.

### Task 3: Regression verification

**Files:**
- No product-file changes unless tests expose a Task 4 defect.

- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm no changes to Manual Search routes/UI and no Task 5+ behavior was added.
- [ ] Commit only the Task 4 implementation/tests/plan on the Task 4 branch.
