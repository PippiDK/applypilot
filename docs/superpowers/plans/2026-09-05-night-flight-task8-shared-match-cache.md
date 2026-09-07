# Night Flight Task 8 — Shared Server-side Match Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared server-side Expertise Match cache that Night Flight can use now and Manual Search can reuse in Task 11, while preserving one existing Match engine.

**Architecture:** Store Match results in Supabase under a deterministic identity composed of user, logical job, frozen profile fingerprint, and Match engine version. Night Flight queue processing calls a small processor that loads the run snapshot, uses the cache on HIT, calls the existing `analyzeExpertiseMatch()` only on MISS, writes successful results, and returns the cache reference to the durable queue. Persist the CV text snapshot on the run so retries/resume never mix profile versions.

**Tech Stack:** Next.js / Node ESM, node:test, Supabase PostgreSQL/RLS, existing `analyzeExpertiseMatch()` and Night Flight durable queue.

**Spec:** `ApplyPilot_V18_Night_Flight_Solution_Specification(2).docx`

## Global Constraints

- Cache is shared between Night Flight and ordinary Manual Search.
- Minimum identity is user + logical job + Search Profile/CV fingerprint/version + Match engine version.
- A valid cache result is reused without a second AI call.
- Changing any identity component makes the old entry stale for that context.
- Night Flight uses the existing Match engine; no new scoring algorithm is introduced.
- Failed Match calculations are not cached.
- One run uses one frozen profile/CV snapshot.
- Manual Search wiring remains out of scope until Task 11.

---

### Task 1: RED cache and schema contracts

**Files:**
- Create: `app/lib/expertise-match-server-cache.test.mjs`

**Interfaces:**
- Produces contract for `EXPERTISE_MATCH_ENGINE_VERSION`, `logicalExpertiseJobKey`, `expertiseMatchCacheReference`, and `getOrCreateExpertiseMatch`.

- [ ] Write failing tests proving same logical vacancy gets one logical key, valid HIT performs zero AI calls, MISS stores successful analysis, profile/engine changes miss, failed analysis is not cached, and the migration defines shared cache + ownership/RLS.
- [ ] Run full CI and confirm pre-existing 606 tests remain green while only Task 8 tests fail.

### Task 2: Shared cache schema and service

**Files:**
- Create: `supabase/migrations/20260905_expertise_match_cache.sql`
- Create: `app/lib/expertise-match-server-cache.js`

**Interfaces:**
- `logicalExpertiseJobKey(job,fallbackKey)` returns a stable logical identity independent of source when safe.
- `getOrCreateExpertiseMatch({supabase,userId,job,logicalJobKey,profileFingerprint,cvText,engineVersion,analyze})` returns `{analysis,matchCacheKey,cacheHit}`.

- [ ] Add `expertise_match_cache` with deterministic `cache_key`, explicit identity columns, JSON analysis, timestamps, composite uniqueness, user ownership/RLS, and authenticated grants.
- [ ] Add `cv_text_snapshot` to `night_flight_runs` for durable profile consistency.
- [ ] Implement cache read/write and existing Match-engine invocation only on MISS.
- [ ] Keep errors uncached and surface them to the durable queue.

### Task 3: Persist run Match snapshot

**Files:**
- Modify: `app/lib/night-flight-last-completed-day.js`
- Modify: `app/lib/night-flight-area-scope.js`

**Interfaces:**
- Discovery batch carries `searchProfileSnapshot`, `cvTextSnapshot`, and `cvSourceVersion` from the already-loaded profile.
- Run persistence stores those exact frozen values.

- [ ] Add snapshot fields to the frozen Task 4 batch.
- [ ] Persist `search_profile_snapshot`, `cv_source_version`, and `cv_text_snapshot` when creating the run.
- [ ] Do not alter discovery, dedupe, area classification, or Manual Search behavior.

### Task 4: Night Flight Match processor and scheduler wiring

**Files:**
- Create: `app/lib/night-flight-match-processor.js`
- Modify: `app/lib/night-flight-scheduler.js`
- Test: `app/lib/night-flight-match-processor.test.mjs`
- Test: `app/lib/night-flight-scheduler.test.mjs`

**Interfaces:**
- `processNightFlightRunMatches({supabase,userId,runId,processQueue,matchService})` loads the frozen run context and calls the durable queue with a cache-aware `processJob`.
- Scheduler invokes that processor for both newly persisted and resumed runs without rerunning discovery.

- [ ] Write failing processor/scheduler tests.
- [ ] Implement run-context load and queue callback using `getOrCreateExpertiseMatch`.
- [ ] Pass returned `matchCacheKey` to Task 6 queue completion.
- [ ] Invoke processing after new run creation or same-date resume.

### Task 5: Regression gate

**Files:**
- No additional product changes unless verification exposes a Task 8 defect.

- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Compare Task 8 branch with Task 7 head and verify Manual Search/UI/scoring are untouched.
