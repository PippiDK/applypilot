# Night Flight Task 11 — Manual Recovery + Shared Cache Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user recover a FAILED Night Flight Match with the existing Match engine and make ordinary Manual Expertise Match reuse the same valid server-side Night Flight cache without a second AI call.

**Architecture:** Keep Task 8 as the single Match/cache implementation. Add one focused recovery service that loads only the authenticated user's frozen Night Flight run/job, invokes `getOrCreateExpertiseMatch()`, transitions that FAILED row to READY on success, and reconciles the run. Extend the existing Night Flight review route with POST for recovery. Wire the existing Morning Review `Run Match` button to that POST. For ordinary Expertise Match, resolve the current synchronized backend profile fingerprint and call the same Task 8 cache service when the request CV matches that synchronized state; preserve the existing direct Match fallback when no valid synchronized cache identity exists.

**Tech Stack:** Next.js 14 App Router, React, Node ESM/node:test, Supabase, existing Expertise Match service/cache.

**Spec:** `ApplyPilot_V18_Night_Flight_Solution_Specification(2).docx`

## Global Constraints

- FAILED → Run Match → existing Match engine → READY.
- Successful manual recovery is stored in the same server-side Expertise Match cache.
- Manual Search reuses a valid Night Flight cache result with no second AI call.
- Manual Search remains Previous / 5 days / 10 days; its search semantics are not changed.
- Night Flight and Manual Match use the same Match engine; no second scoring model.
- Profile Match content/logic is unchanged.
- Existing LinkedIn / Jobindex / Jobnet behaviour is unchanged.
- Company Watch, Consultant Portals, auth/splash/logo behaviour are unchanged.
- No database migration and no LIVE deployment in Task 11.

---

### Task 1: RED contracts for manual recovery and shared cache reuse

**Files:**
- Create: `app/lib/night-flight-manual-recovery.test.mjs`
- Create: `app/lib/expertise-match-manual-server-cache.test.mjs`
- Modify: `app/lib/night-flight-morning-review-ui.contract.test.mjs`
- Modify: `app/lib/night-flight-review-api.contract.test.mjs`

**Interfaces:**
- Produces contract for `recoverFailedNightFlightMatch(...)`.
- Produces contract for manual Expertise Match server-cache reuse through `resolveManualExpertiseMatch(...)`.
- Produces POST review route and enabled `Run Match` UI contracts.

- [ ] Write failing tests proving FAILED recovery uses the shared Match service and becomes READY, Match failure leaves the row FAILED, a valid manual cache identity produces zero AI calls, review POST is authenticated, and the UI invokes recovery then refreshes saved review state.
- [ ] Run the Task 11 tests and full suite to confirm failures are caused only by missing Task 11 behavior.
- [ ] Commit RED tests before production code.

### Task 2: Shared manual Expertise Match cache reuse

**Files:**
- Modify: `app/lib/expertise-match-server-cache.js`
- Modify: `app/api/expertise-match/route.js`
- Modify: `app/lib/expertise-match-client.js`
- Modify: `app/page.js`

**Interfaces:**
- `resolveManualExpertiseMatch({supabase,userId,job,cvText,profileState,analyze})` returns `{analysis,matchCacheKey,cacheHit}` and delegates to Task 8 cache only when the synchronized profile state matches the current CV.
- `/api/expertise-match` loads the authenticated user's latest synchronized backend profile and returns the same existing `{analysis}` API payload.

- [ ] Implement the minimum shared-cache wrapper around `getOrCreateExpertiseMatch()`.
- [ ] Send the current CV source version from the existing manual client path so validity can be checked without changing Match semantics.
- [ ] Preserve direct existing Match behavior when a valid shared-cache identity is unavailable.
- [ ] Run focused tests and keep existing manual Match API/client contracts green.

### Task 3: FAILED Night Flight manual recovery

**Files:**
- Create: `app/lib/night-flight-manual-recovery.js`
- Modify: `app/api/night-flight-review/route.js`
- Modify: `app/components/night-flight-morning-review.js`

**Interfaces:**
- `recoverFailedNightFlightMatch({supabase,userId,runId,jobKey,matchService,reconcile})` accepts only the authenticated user's FAILED row, uses the run's frozen profile/CV snapshot, stores the shared cache key on success, and reconciles the run.
- `POST /api/night-flight-review` accepts `{runId,jobKey}` and returns `{review}` after recovery.

- [ ] Load the user-scoped run and selected FAILED job.
- [ ] Invoke `getOrCreateExpertiseMatch()` with the frozen Task 8 run snapshot and logical job key.
- [ ] CAS-update only FAILED → READY, clear `last_error`, persist `match_cache_key`/`processed_at`, then reconcile run counters/status.
- [ ] Leave FAILED unchanged if Match calculation fails.
- [ ] Enable `Run Match`, show in-flight/error state, replace review with POST response, and keep the recovered job selected.
- [ ] Run focused service/API/UI tests.

### Task 4: Verification gate

**Files:**
- No additional product changes unless verification proves a Task 11 defect.

- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Compare Task 10 HEAD `d88e74e601d9a4010d87fbe47cd954397ecae37c` to Task 11 HEAD and verify only Task 11 recovery/cache wiring changed.
- [ ] Confirm no migration, search-source/scoring change, Task 12 work, or LIVE deployment was introduced.
