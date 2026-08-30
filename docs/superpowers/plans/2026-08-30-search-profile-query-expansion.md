# Search Profile Query Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand LinkedIn discovery from approved Search Profile roles with generic AI-derived broader title queries while preserving the original Search Profile as the only relevance authority.

**Architecture:** Add a focused query-expansion module that returns validated broader title phrases per approved role. Discovery directions gain a separate `query` field and provenance mode, so LinkedIn searches can use broader phrases while downstream `profileEvaluation` continues to evaluate against the original approved `role`. `searchLinkedInProfile` invokes expansion defensively and falls back to exact-only discovery on any expansion failure.

**Tech Stack:** Next.js 14, Node.js ES modules, node:test, existing structured OpenAI client, LinkedIn guest search discovery.

**Spec:** `docs/superpowers/specs/2026-08-30-search-profile-query-expansion-design.md`

## Global Constraints

- `main` must remain unchanged.
- Search Profile approved roles remain the only source of search intent.
- Maximum 3 expanded queries per source role.
- Expanded queries are discovery-only and must not alter scoring or KEEP/REJECT semantics.
- Existing LinkedIn pagination 0/25/50/75 remains unchanged.
- Expansion failure must degrade to exact-only search.

---

### Task 1: Generic query expansion contract

**Files:**
- Create: `app/lib/search-query-expansion-ai.js`
- Create: `app/lib/search-query-expansion-ai.test.mjs`

**Interfaces:**
- Produces: `validateSearchQueryExpansions(value, sourceRoles)` and `buildSearchQueryExpansions({roles, modelCall})`.

- [ ] **Step 1: Write failing validation tests** for max-3, duplicate/exact-role removal, and domain independence using `Senior IT Delivery Manager` and `Senior Concept Artist`.
- [ ] **Step 2: Run the test file and confirm RED** because the production module does not exist.
- [ ] **Step 3: Implement the structured AI schema, instructions, validation, and builder** using the existing `callStructuredAi` client.
- [ ] **Step 4: Run the test file and confirm GREEN.**

### Task 2: Discovery query/provenance separation

**Files:**
- Modify: `app/lib/linkedin-shadow-discovery.js`
- Modify: `app/lib/linkedin-shadow-discovery.test.mjs`

**Interfaces:**
- Consumes discovery directions shaped as `{role, query?, discoveryMode?, ...existing provenance}`.
- Uses `query || role` for LinkedIn `keywords` while preserving `role` for relevance evaluation.

- [ ] **Step 1: Add failing tests** proving expanded directions search with the broader `query`, preserve `role`, aggregate EXACT/EXPANDED provenance, and dedupe the same `jobId` across both.
- [ ] **Step 2: Run the test file and confirm RED.**
- [ ] **Step 3: Implement minimal normalization and request changes** without changing pagination.
- [ ] **Step 4: Run the discovery tests and confirm GREEN, including the pagination regression.**

### Task 3: Search integration and safe fallback

**Files:**
- Modify: `app/lib/linkedin-profile-search.js`
- Modify/Create test coverage in the existing profile-search test file.

**Interfaces:**
- `searchLinkedInProfile` gains injectable `queryExpander` for tests; production default is `buildSearchQueryExpansions`.
- Builds exact + expanded discovery directions from the original `unionSearchPlan`, deduplicated case-insensitively.

- [ ] **Step 1: Add failing tests** proving expansion directions are added, original roles remain authoritative for profile evaluation, and a rejected/throwing expander falls back to exact-only discovery.
- [ ] **Step 2: Run the focused profile-search tests and confirm RED.**
- [ ] **Step 3: Implement minimal expansion-plan construction and fallback.**
- [ ] **Step 4: Run focused tests and confirm GREEN.**

### Task 4: Audit provenance

**Files:**
- Modify: `app/lib/linkedin-search-audit.js`
- Modify corresponding audit tests if present.

**Interfaces:**
- Audit record preserves a compact discovery provenance array derived from candidate `foundBy`, including mode, query, and source role.

- [ ] **Step 1: Add failing audit test** for EXACT vs EXPANDED provenance retention.
- [ ] **Step 2: Run and confirm RED.**
- [ ] **Step 3: Implement provenance as additive audit data without changing existing audit decision fields.**
- [ ] **Step 4: Run and confirm GREEN.**

### Task 5: Verification and TEST preview

**Files:** No additional production behavior.

- [ ] **Step 1: Run all touched test files plus existing profile/discovery regressions.**
- [ ] **Step 2: Run production build.**
- [ ] **Step 3: Compare feature branch against `main` and verify only intended files changed.**
- [ ] **Step 4: Update only `feature/search-profile-query-expansion` to the verified commit, producing the TEST/preview deployment.**
- [ ] **Step 5: Verify preview is READY/HTTP 200 and confirm `main` still points to `f346397aa065053ebc7966d1c09d28cfc35f015c`.**
