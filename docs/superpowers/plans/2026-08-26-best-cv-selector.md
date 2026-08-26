# Best CV Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual, cached one-call Best CV selector for the existing three-slot CV Library without changing Search or Expertise Match.

**Architecture:** Browser-local CV Library remains the source of CV candidates. A dedicated Best CV client sends the selected Full JD plus the ready CV records to a protected Best CV API; the server deterministically builds compact selector packets and makes one structured AI comparison call. The browser caches the result by job/JD/CV-library fingerprint and records a vacancy-specific selected CV for later application work.

**Tech Stack:** Next.js 14 App Router, React 18, browser localStorage, existing `callStructuredAi`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-best-cv-selector-design.md`

## Global Constraints

- TEST branch only: `feature/cv-library-3-slots`.
- `main` must not change.
- `MAX_CVS=3`; candidates are `CV 1`, `CV 2`, `CV 3` only.
- Never merge facts across CVs.
- Best CV has no percentage.
- No automatic AI on vacancy open/navigation.
- One explicit uncached comparison = one AI call; unchanged inputs = cache hit and zero AI.
- Do not modify LinkedIn Search, Search Profile, or Expertise Match implementation.
- Stop before CV Update generation.

---

### Task 1: Selector packets and structured result validation

**Files:**
- Create: `app/lib/best-cv-selector.js`
- Test: `app/lib/best-cv-selector.test.mjs`

**Interfaces:**
- Produces: `BEST_CV_SELECTOR_VERSION`, `buildSelectorPacket(cv)`, `validateBestCvResult(value,candidateIds)`, `analyzeBestCv({job,cvs,modelCall})`.
- Consumes: existing `detectCvStructure(cvText)` and `callStructuredAi(...)`.

- [ ] **Step 1: Write failing tests** for deterministic packets, fallback preservation, one-call comparison, invalid candidate rejection, complete ranking, and `use_as_is|update_recommended` validation.
- [ ] **Step 2: Run focused tests and confirm RED** because the module does not yet exist.
- [ ] **Step 3: Implement packet builder and strict structured result validation.** Packet mode preserves summary, skills, latest/previous role evidence and older role context; unsafe structure uses full parsed text fallback.
- [ ] **Step 4: Implement `analyzeBestCv`** with one `callStructuredAi` request containing the Full JD and all available packets, explicit no-merge/no-invention instructions, and a strict JSON schema.
- [ ] **Step 5: Re-run focused tests and confirm GREEN.**

### Task 2: Browser cache and API client

**Files:**
- Create: `app/lib/best-cv-cache.js`
- Create: `app/lib/best-cv-cache.test.mjs`
- Create: `app/lib/best-cv-client.js`
- Create: `app/lib/best-cv-client.test.mjs`

**Interfaces:**
- Produces: `bestCvCacheKey({jobId,description,cvs})`, `readBestCvCache(...)`, `writeBestCvCache(...)`, `requestBestCv({job,cvs,fetchImpl})`.

- [ ] **Step 1: Write failing cache tests** proving the key changes when JD text, candidate membership, or any sourceVersion changes and that an unchanged key reuses saved analysis.
- [ ] **Step 2: Write failing client tests** proving one POST to `/api/best-cv`, all ready candidate records are sent once, and safe server errors surface.
- [ ] **Step 3: Run focused tests and confirm RED.**
- [ ] **Step 4: Implement deterministic browser-safe hashing and localStorage read/write.** Prefix includes the selector version.
- [ ] **Step 5: Implement the dedicated API client and confirm GREEN.**

### Task 3: Protected Best CV API

**Files:**
- Create: `app/api/best-cv/route.js`
- Create: `app/lib/best-cv-api.contract.test.mjs`

**Interfaces:**
- Consumes: `analyzeBestCv({job,cvs})`, existing `requireUser()`.
- Produces: `POST /api/best-cv -> {analysis}`.

- [ ] **Step 1: Write failing route contract test** requiring auth, dedicated Best CV service call, no Search imports/calls, safe AI error mapping, and no CV/JD data in logs.
- [ ] **Step 2: Run test and confirm RED.**
- [ ] **Step 3: Implement protected route** that sanitizes job/candidate fields, calls `analyzeBestCv`, and returns only safe errors.
- [ ] **Step 4: Re-run route test and confirm GREEN.**

### Task 4: Manual right-panel Best CV flow

**Files:**
- Modify: `app/page.js`
- Modify: `app/globals.css`
- Create: `app/lib/best-cv-ui.contract.test.mjs`

**Interfaces:**
- Consumes: CV Library state, active vacancy, Best CV client/cache.
- Produces: idle/loading/result/error UI and vacancy-specific selected `CV N` state.

- [ ] **Step 1: Write failing UI contract test** requiring `BEST CV FOR THIS JOB`, `Find best CV`, no percentage, explicit manual handler, cache read/write, `USE AS IS|UPDATE RECOMMENDED`, ranked CVs and `Use this CV`.
- [ ] **Step 2: Confirm RED against the current page.**
- [ ] **Step 3: Wire Best CV state/effect** so vacancy navigation reads cache but never calls AI automatically.
- [ ] **Step 4: Wire `Find best CV`**: require at least one ready CV; one candidate degrades locally to the only available CV; two/three candidates call the API once unless cache exists.
- [ ] **Step 5: Render compact Best CV card above Expertise Match** with winner filename, recruiter reason, advice badge, update-focus list, ranked order, and `Use this CV` selection state.
- [ ] **Step 6: Add minimal scoped CSS** without redesigning the panel or version badge.
- [ ] **Step 7: Run UI contract test and confirm GREEN.**

### Task 5: Verification and isolation

**Files:** no new production files.

- [ ] **Step 1: Run all new focused Node tests** and confirm zero failures.
- [ ] **Step 2: Run/inspect production build** and confirm Next.js compile/lint/type validation succeeds.
- [ ] **Step 3: Compare final TEST head to pre-feature head `08ed2629ba381792fe3affb2b4ba82f18e991922`.** Reject any diff in LinkedIn Search, Search Profile, or Expertise Match implementation files.
- [ ] **Step 4: Confirm Vercel deployment is READY** for the exact final SHA and the preview alias serves the new badge SHA.
- [ ] **Step 5: Manual smoke target:** opening a vacancy shows `Not analysed`; only button click analyzes; reopening unchanged vacancy shows cached result; replacing/removing a CV invalidates the Best CV cache; selecting winner does not automatically run Expertise Match or CV Update.