# Persistent LinkedIn Search Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-request profile-driven LinkedIn search with a resumable, persistent Search Run state machine that exhausts observable public pagination and processes Full JDs in adaptive batches.

**Architecture:** Production persists checkpoints in Supabase (`search_runs`, `search_candidates`) under RLS; Vercel Preview uses session persistence because its auth bypass has no Supabase user session. Pure discovery and JD-batch modules are shared by both adapters. Existing profile evaluation logic is reused unchanged.

**Tech Stack:** Next.js 14 App Router, React 18, Node test runner, Supabase Postgres/RLS, `@supabase/ssr`, existing LinkedIn stable fetcher.

**Spec:** `docs/superpowers/specs/2026-08-27-linkedin-batched-profile-search-design.md`

## Global Constraints

- Do not change Search relevance scoring, Search Profile semantics, Union Search Plan semantics, BUG #3 multilingual role confirmation, role thresholds, exclusions, or CV logic.
- `main` remains untouched.
- Deployment gate remains closed.
- Completeness means observable public LinkedIn endpoint results during the run.
- Production data is owner-scoped by RLS.

---

### Task 1: Pure resumable discovery state machine

**Files:**
- Create: `app/lib/linkedin-profile-discovery-batch.js`
- Create: `app/lib/linkedin-profile-discovery-batch.test.mjs`

**Interfaces:**
- `createDiscoveryState(unionSearchPlan)` → serializable cursor/state.
- `runDiscoveryBatch({freshnessDays, unionSearchPlan, state, knownCandidates, fetcher, maxRequests})` → `{state,candidates,complete,accessLimited,stats}`.

- [ ] Write failing tests proving pagination reaches `75/100+`, stops on empty/exact-repeat/two no-new pages, merges duplicates and reports access limitation.
- [ ] Run targeted tests and confirm RED.
- [ ] Implement minimal state machine using existing `parseSearchHtml` and LinkedIn query shape.
- [ ] Run targeted tests and confirm GREEN.
- [ ] Commit.

### Task 2: Reusable existing profile evaluation + adaptive Full JD batch

**Files:**
- Modify: `app/lib/linkedin-profile-search.js`
- Create: `app/lib/linkedin-profile-jd-batch.js`
- Create: `app/lib/linkedin-profile-jd-batch.test.mjs`

**Interfaces:**
- Export `evaluateProfileJob({candidate,job,freshnessDays,exclusionRules,now})` from the existing profile search module, implemented from the exact current post-detail logic.
- `runProfileJdBatch({candidates,fetcher,freshnessDays,exclusionRules,now,maxCandidates,safeBudgetMs,clock})` → processed rows, kept jobs, audits, access flag and continuation count.

- [ ] Write failing tests proving candidate 31+ survives to a later invocation and time-budget early stop resumes cleanly.
- [ ] Refactor only enough existing logic to expose the evaluator; run BUG #3 regression immediately.
- [ ] Implement adaptive JD processor with maximum 30 and safe-time cutoff.
- [ ] Run new tests + BUG #3 tests.
- [ ] Commit.

### Task 3: Supabase Search Run repository and authenticated APIs

**Files:**
- Create: `app/lib/search-run-store.js`
- Create: `app/lib/search-run-store.test.mjs`
- Create: `app/api/linkedin-profile-search/run/route.js`
- Create: `app/api/linkedin-profile-search/discover/route.js`
- Create: `app/api/linkedin-profile-search/process/route.js`

**Interfaces:**
- Repository accepts a request-scoped Supabase client and authenticated user id.
- Routes create/load/update owner-scoped runs and upsert candidates idempotently.
- Preview routes return/use client-carried state instead of attempting RLS writes as `vercel-preview`.

- [ ] Write repository contract tests with a fake Supabase adapter.
- [ ] Implement create/load/update/upsert/pending operations.
- [ ] Implement production and preview route contracts.
- [ ] Run route/repository tests.
- [ ] Commit.

### Task 4: Client orchestrator, progress and recovery

**Files:**
- Create: `app/lib/profile-search-run-client.js`
- Create: `app/lib/profile-search-run-client.test.mjs`
- Modify: `app/page.js`

**Interfaces:**
- `runProfileSearch({...callbacks})` performs create/resume → discovery loop → JD loop → final result using one user click.
- Preview run snapshots are checkpointed in `sessionStorage`.
- Production obtains persistent snapshots from run APIs.

- [ ] Write orchestration tests for multiple discovery/JD calls and recovery.
- [ ] Implement orchestration helper.
- [ ] Replace only the profile-driven branch of `search()` in `app/page.js`; legacy search fallback remains untouched.
- [ ] Show `Discovered N · Full JDs read X / N` while running.
- [ ] Run UI contract and orchestrator tests.
- [ ] Commit.

### Task 5: Verification and rollout gate

**Files:** no product changes unless tests identify a defect.

- [ ] Run discovery-batch tests.
- [ ] Run JD-batch tests.
- [ ] Run Search Run repository/client tests.
- [ ] Run BUG #3 regression: Atea/PET/Regionshospitalet KEEP; Energinet REJECT.
- [ ] Run relevant Search Profile/Union Search Plan tests.
- [ ] Run full repository test suite and report any pre-existing unrelated failures separately.
- [ ] Run `npm run build` on Node 24.
- [ ] Run Supabase security/performance advisors.
- [ ] Confirm branch diff, `vercel.json` gate false, and `main` unchanged.
- [ ] Do not deploy without explicit authorization.
