# Multi-CV Search Profiles Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build independent Search Profile role proposals for every ready CV, show their deduplicated union in the existing role-review UX, and leave LinkedIn Search completely unchanged.

**Architecture:** Keep the existing one-CV AI classifier and per-sourceVersion cache. Add a deterministic library helper that wraps each CV result with provenance, computes a stable library fingerprint, and unions Primary/Adjacent roles. `page.js` orchestrates cache reuse and only calls AI for uncached CVs; the existing Search Profile modal remains the user-facing flow.

**Tech Stack:** Next.js 14, React 18, Node `node:test`, browser `localStorage`, existing structured OpenAI client.

**Spec:** `docs/superpowers/specs/2026-08-26-multi-cv-search-profiles-step1-design.md`

## Global Constraints

- Work only on `feature/cv-library-3-slots`; do not modify `main`.
- Do not modify `app/lib/linkedin-search.js` or `app/lib/linkedin-stable-search.js`.
- Do not connect Search Profile to LinkedIn Search in this step.
- Keep the existing Search request payload `{freshnessDays, cvText: cvData.cvText}` unchanged.
- Cache role classification per CV `sourceVersion`; unchanged siblings must not be regenerated.
- Do not merge CV text or create a consolidated/master CV.
- Keep the five-step Search Profile UX and editable combined Primary / Adjacent role lists.

---

### Task 1: Deterministic multi-CV role-profile model

**Files:**
- Create: `app/lib/search-profile-library.js`
- Create: `app/lib/search-profile-library.test.mjs`

**Interfaces:**
- Produces `buildCvRoleProfile(cv, roles) -> CvRoleProfile`.
- Produces `searchProfileLibraryFingerprint(cvs) -> string`.
- Produces `combineCvRoleProfiles(profiles) -> {primaryRoles, adjacentRoles, roleSources}`.

- [ ] Write failing tests for three distinct profiles, Primary promotion, Adjacent suppression, case/whitespace dedupe, provenance, one-CV semantics, and fingerprint changes only when the ready CV set/sourceVersions change.
- [ ] Run `node --test app/lib/search-profile-library.test.mjs` and verify RED because the module/functions do not exist.
- [ ] Implement the smallest deterministic helper satisfying those tests.
- [ ] Run the same test and verify GREEN.

### Task 2: Multi-CV cache orchestration without changing the AI classifier contract

**Files:**
- Modify: `app/lib/search-profile-cache.test.mjs`
- Keep behavior-compatible: `app/lib/search-profile-cache.js`
- Keep behavior-compatible: `app/lib/search-profile-ai.js`
- Keep behavior-compatible: `app/api/search-profile/route.js`

**Interfaces:**
- Existing `readSearchProfileCache({storage, sourceVersion})` and `writeSearchProfileCache(...)` remain the per-CV cache boundary.
- Existing `requestSearchProfileRoles({cvText})` remains one CV per AI call.

- [ ] Add failing/contract tests proving different sourceVersions have independent cache entries and replacing one CV does not invalidate sibling entries.
- [ ] Run tests and verify behavior; only change cache code if a test exposes a real gap.
- [ ] Preserve the existing classifier schema and API route so no monolithic three-CV AI request is introduced.

### Task 3: Wire Search Profile role generation to all ready CVs

**Files:**
- Modify: `app/page.js`
- Modify: `app/components/search-profile-roles-step.js`
- Add/modify Search Profile contract tests as needed.

**Interfaces:**
- `buildProfileRoles({forceCvIds=[]})` reads every ready CV from `cvLibrary`.
- Cached CVs are wrapped immediately; only missing/forced CV ids call `requestSearchProfileRoles`.
- Successful profiles are combined with `combineCvRoleProfiles` and stored in draft as `cvRoleProfiles`, `roleSources`, `rolesLibraryFingerprint`, and `rolesBuilderVersion`.
- `profileRoleState` tracks total CV count, analysed count, failed CV ids/names, and source (`saved`, `cache`, `ai`, `mixed`).

- [ ] Add a failing static/contract test proving the role step no longer says `from CV 1`, the page iterates ready CVs, and the LinkedIn Search payload remains unchanged.
- [ ] Verify RED against current code.
- [ ] Implement library-aware generation with safe partial failure and retry limited to failed CV ids.
- [ ] Save multi-CV metadata while preserving existing `primaryRoles`, `adjacentRoles`, `roles`, and legacy `rolesSourceVersion` compatibility.
- [ ] Add a confirmation row showing how many ready CV role profiles were analysed, so partial generation is never silently represented as complete.
- [ ] Run targeted Search Profile tests and verify GREEN.

### Task 4: Regression and deployment verification

**Files:**
- No Search-core edits permitted.

- [ ] Run all locally runnable pure Node tests for the changed Search Profile modules.
- [ ] Compare TEST head against the pre-feature baseline and verify no changes to `app/lib/linkedin-search.js` or `app/lib/linkedin-stable-search.js`.
- [ ] Verify the literal Search request payload is still `{freshnessDays,cvText:cvData.cvText}`.
- [ ] Commit/push only to `feature/cv-library-3-slots`.
- [ ] Check the Vercel preview deployment reaches READY and inspect build logs for compile/lint/type errors.
- [ ] Stop after Step 1; do not implement Union Search Plan.