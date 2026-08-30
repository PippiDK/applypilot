# Jobindex Multi-Source Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selectable LinkedIn and Jobindex discovery sources to ApplyPilot while preserving the existing Search Profile and evaluator behavior, combining normalized results through conservative cross-source deduplication.

**Architecture:** Introduce a source orchestration layer that invokes independent LinkedIn and Jobindex adapters in parallel, normalizes both to one job contract, conservatively merges obvious duplicates, and returns one combined result set to the existing UI/evaluation flow. LinkedIn internals remain intact behind a thin adapter; Jobindex-specific acquisition and parsing stay isolated in its adapter.

**Tech Stack:** Next.js 14.2.15, React 18.3.1, Node.js ES modules, Node built-in test runner (`node --test`), browser `localStorage`, existing ApplyPilot auth and LinkedIn search libraries.

**Spec:** `docs/superpowers/specs/2026-08-30-jobindex-multisource-search-design.md`

## Global Constraints

- `main` must remain unchanged until TEST implementation, review, and explicit merge approval.
- Search Profile remains the single definition of what to search for; do not create source-specific profiles.
- Existing LinkedIn discovery, query expansion, pagination, and evaluator behavior must not be rewritten to support Jobindex.
- LinkedIn and Jobindex are equal selectable sources in the UI; both are enabled by default for a new user.
- Source selection persists independently of Search Profile.
- Common user-facing filters must retain one ApplyPilot meaning across all sources.
- Source failure must be fail-soft: one failed source must not discard successful results from another source.
- Cross-source dedupe is conservative; uncertain duplicates stay separate.
- No aggressive fuzzy dedupe in version 1.
- No additional sources (The Hub, Jobnet, etc.) in version 1.
- Temporary `spike/jobindex-vercel-probe` code is evidence only; do not merge or copy the probe route as production architecture.
- Use TDD for implementation changes and commit each independently testable task.

---

## File Structure

### Create

- `app/lib/search-sources.js` — source IDs, defaults, validation, and persisted source-selection helpers.
- `app/lib/normalized-job.js` — normalized job contract helpers and source provenance helpers.
- `app/lib/cross-source-dedupe.js` — conservative duplicate matching and merge behavior.
- `app/lib/linkedin-source-adapter.js` — thin adapter around existing LinkedIn flows.
- `app/lib/jobindex-source-adapter.js` — Jobindex query execution, pagination, detail retrieval, and normalization entry point.
- `app/lib/jobindex-parser.js` — pure parsing helpers for Jobindex search/detail HTML.
- `app/lib/search-source-orchestrator.js` — parallel source execution, failure isolation, result collection, normalization, and dedupe.
- `app/api/multi-source-search/route.js` — authenticated API entry point for enabled-source search.
- `app/lib/search-sources.test.mjs`
- `app/lib/normalized-job.test.mjs`
- `app/lib/cross-source-dedupe.test.mjs`
- `app/lib/linkedin-source-adapter.test.mjs`
- `app/lib/jobindex-parser.test.mjs`
- `app/lib/jobindex-source-adapter.test.mjs`
- `app/lib/search-source-orchestrator.test.mjs`

### Modify

- `app/page.js` — source-selection state, persistence, `SEARCH SOURCES` UI, call to `/api/multi-source-search`, combined source labels, fail-soft source warning rendering, and generic Search button copy.
- `app/globals.css` or the existing relevant control stylesheet — compact source-selector styling only if current classes cannot express the approved UI.

### Preserve Unless a Failing Test Proves a Compatibility Need

- `app/api/linkedin-profile-search/route.js`
- `app/lib/linkedin-profile-search.js`
- `app/lib/linkedin-shadow-discovery.js`
- `app/lib/search-query-expansion-ai.js`
- existing evaluator/expertise-match modules
- Search Profile persistence/building modules

---

### Task 1: Search Source Selection Model and Persistence

**Files:**
- Create: `app/lib/search-sources.js`
- Create: `app/lib/search-sources.test.mjs`
- Modify: `app/page.js`

**Interfaces:**
- Produces: `SEARCH_SOURCE_IDS`, `DEFAULT_SEARCH_SOURCES`, `SEARCH_SOURCES_STORAGE_KEY`, `normalizeSearchSources(value)`, `readSearchSources(storage)`, `writeSearchSources(storage, sources)`.
- Consumers: `app/page.js`, later `/api/multi-source-search` request construction.

- [ ] **Step 1: Write failing tests for defaults, validation, and persistence**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SEARCH_SOURCES,
  normalizeSearchSources,
  readSearchSources,
  writeSearchSources,
} from './search-sources.js'

test('new users default to LinkedIn and Jobindex enabled', () => {
  assert.deepEqual(DEFAULT_SEARCH_SOURCES, ['linkedin', 'jobindex'])
  assert.deepEqual(normalizeSearchSources(undefined), ['linkedin', 'jobindex'])
})

test('normalization removes unknown and duplicate source ids', () => {
  assert.deepEqual(normalizeSearchSources(['jobindex', 'linkedin', 'jobindex', 'bogus']), ['linkedin', 'jobindex'])
})

test('persisted empty selection remains empty instead of resetting to defaults', () => {
  const memory = new Map()
  const storage = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, value),
  }
  writeSearchSources(storage, [])
  assert.deepEqual(readSearchSources(storage), [])
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test app/lib/search-sources.test.mjs`

Expected: FAIL because `search-sources.js` does not exist.

- [ ] **Step 3: Implement the minimal source-selection helper**

```js
export const SEARCH_SOURCE_IDS = ['linkedin', 'jobindex']
export const DEFAULT_SEARCH_SOURCES = [...SEARCH_SOURCE_IDS]
export const SEARCH_SOURCES_STORAGE_KEY = 'applypilot-search-sources'

export function normalizeSearchSources(value, { defaultWhenMissing = true } = {}) {
  if (!Array.isArray(value)) return defaultWhenMissing ? [...DEFAULT_SEARCH_SOURCES] : []
  return SEARCH_SOURCE_IDS.filter(id => value.includes(id))
}

export function readSearchSources(storage) {
  const raw = storage?.getItem?.(SEARCH_SOURCES_STORAGE_KEY)
  if (raw == null) return [...DEFAULT_SEARCH_SOURCES]
  try { return normalizeSearchSources(JSON.parse(raw), { defaultWhenMissing: false }) }
  catch { return [...DEFAULT_SEARCH_SOURCES] }
}

export function writeSearchSources(storage, sources) {
  const normalized = normalizeSearchSources(sources, { defaultWhenMissing: false })
  storage?.setItem?.(SEARCH_SOURCES_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run: `node --test app/lib/search-sources.test.mjs`

Expected: PASS.

- [ ] **Step 5: Wire persisted state into `app/page.js` without changing Search Profile state**

Add imports for the helpers, initialize `selectedSources` with both IDs, hydrate it in the existing mount effect via `readSearchSources(localStorage)`, and persist every explicit toggle through `writeSearchSources(localStorage, next)`.

Do not put source selection inside `profile`, `draft`, or `applypilot-profile`.

- [ ] **Step 6: Add zero-source client validation**

At the beginning of `search()`, before network work:

```js
if (!selectedSources.length) {
  setState(current => ({ ...current, loading: false, error: 'Select at least one search source.' }))
  return
}
```

- [ ] **Step 7: Run the full existing unit suite**

Run: `npm test`

Expected: all pre-existing tests plus `search-sources.test.mjs` PASS.

- [ ] **Step 8: Commit**

```bash
git add app/lib/search-sources.js app/lib/search-sources.test.mjs app/page.js
git commit -m "feat: add persisted search source selection"
```

---

### Task 2: Define the Common Job Contract and Provenance

**Files:**
- Create: `app/lib/normalized-job.js`
- Create: `app/lib/normalized-job.test.mjs`

**Interfaces:**
- Produces: `normalizeSourceRecord(record)`, `normalizeJob(job)`, `sourceLabel(job)`, `bestFullJd(sourceRecords, fallback)`.
- Contract fields: `jobId`, `sourceJobId`, `title`, `company`, `location`, `postedDate`, `detailUrl`, `applicationUrl`, `fullJd`, `sourceRecords` plus existing evaluator-facing fields copied through when present.
- Consumers: both source adapters, dedupe, orchestrator, UI.

- [ ] **Step 1: Write failing contract/provenance tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJob, sourceLabel, bestFullJd } from './normalized-job.js'

test('normalizes one LinkedIn source record', () => {
  const job = normalizeJob({
    sourceJobId: '123',
    title: 'Delivery Manager',
    company: 'Acme',
    location: 'Copenhagen',
    fullJd: 'LinkedIn JD',
    sourceRecords: [{ source: 'linkedin', sourceJobId: '123', detailUrl: 'https://linkedin.example/123' }],
  })
  assert.equal(job.jobId, 'linkedin:123')
  assert.equal(sourceLabel(job), 'LinkedIn')
})

test('combined provenance renders both source names in stable order', () => {
  const job = normalizeJob({
    jobId: 'merged:test', title: 'Delivery Manager', company: 'Acme',
    sourceRecords: [{ source: 'jobindex' }, { source: 'linkedin' }],
  })
  assert.equal(sourceLabel(job), 'LinkedIn · Jobindex')
})

test('bestFullJd selects a usable JD from either source', () => {
  assert.equal(bestFullJd([{ source: 'linkedin', fullJd: '' }, { source: 'jobindex', fullJd: 'Complete JD' }], ''), 'Complete JD')
})
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test app/lib/normalized-job.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement normalized contract helpers**

Preserve existing evaluator-facing properties by spreading the original job first, then overwrite canonical normalized properties. Keep `sourceRecords` as structured provenance. Generate a fallback `jobId` from the source plus `sourceJobId`; do not replace existing `sourceJobId` because current UI/cache logic uses it.

- [ ] **Step 4: Run focused test**

Run: `node --test app/lib/normalized-job.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/normalized-job.js app/lib/normalized-job.test.mjs
git commit -m "feat: define normalized multi-source job contract"
```

---

### Task 3: Conservative Cross-Source Deduplication

**Files:**
- Create: `app/lib/cross-source-dedupe.js`
- Create: `app/lib/cross-source-dedupe.test.mjs`

**Interfaces:**
- Consumes: normalized jobs from `normalizeJob()`.
- Produces: `dedupeJobs(jobs)` and `isHighConfidenceDuplicate(a, b)`.
- Consumer: source orchestrator.

- [ ] **Step 1: Write failing tests for safe merge and safe non-merge**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { dedupeJobs } from './cross-source-dedupe.js'

test('merges obvious same vacancy across sources', () => {
  const jobs = dedupeJobs([
    { jobId:'linkedin:1', sourceJobId:'1', title:'Senior Project Manager', company:'Acme A/S', location:'Copenhagen', applicationUrl:'https://acme.example/jobs/42', fullJd:'', sourceRecords:[{source:'linkedin'}] },
    { jobId:'jobindex:h1', sourceJobId:'h1', title:'Senior Project Manager', company:'Acme A/S', location:'Copenhagen', applicationUrl:'https://acme.example/jobs/42', fullJd:'Full JD', sourceRecords:[{source:'jobindex'}] },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceRecords.length, 2)
  assert.equal(jobs[0].fullJd, 'Full JD')
})

test('does not merge merely similar vacancies when identity is uncertain', () => {
  const jobs = dedupeJobs([
    { jobId:'linkedin:1', title:'Project Manager', company:'Acme', location:'Copenhagen', applicationUrl:'', sourceRecords:[{source:'linkedin'}] },
    { jobId:'jobindex:h2', title:'Senior Project Manager', company:'Acme', location:'Copenhagen', applicationUrl:'', sourceRecords:[{source:'jobindex'}] },
  ])
  assert.equal(jobs.length, 2)
})
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test app/lib/cross-source-dedupe.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement the first deliberately narrow matching rule set**

Version 1 high-confidence merge rules:

1. If both records have the same normalized non-empty external `applicationUrl`, merge.
2. Otherwise, if both have exact normalized `company + title + location` **and** dates do not conflict materially, merge.
3. Never fuzzy-match titles in version 1.
4. Never merge two records from the same source solely because title/company/location match.

Normalize only mechanical differences: trim, lowercase, collapse whitespace, remove trailing slash from URLs, and normalize obvious company suffix punctuation. Do not use semantic similarity or AI.

- [ ] **Step 4: Merge provenance and best available detail safely**

When merging:

- union `sourceRecords` without duplicate source-record identity
- choose a usable `fullJd` via `bestFullJd`
- preserve existing evaluator-facing fields from the record with richer JD/data unless doing so would erase non-empty fields from the other record
- keep one stable `sourceJobId` for current UI/cache compatibility and retain every original source ID inside `sourceRecords`

- [ ] **Step 5: Run focused tests**

Run: `node --test app/lib/cross-source-dedupe.test.mjs app/lib/normalized-job.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/cross-source-dedupe.js app/lib/cross-source-dedupe.test.mjs
git commit -m "feat: add conservative cross-source job dedupe"
```

---

### Task 4: Thin LinkedIn Source Adapter Without LinkedIn Logic Changes

**Files:**
- Create: `app/lib/linkedin-source-adapter.js`
- Create: `app/lib/linkedin-source-adapter.test.mjs`
- Read/preserve: `app/lib/linkedin-profile-search.js`, `app/lib/search-query-expansion-ai.js`, `app/lib/linkedin-stable-fetcher.js`

**Interfaces:**
- Produces: `searchLinkedInSource({ freshnessDays, unionSearchPlan, exclusionRules, cvText, dependencies })`.
- Returns: `{ source:'linkedin', status:'success'|'partial'|'failed', jobs, coverage, stats, audit, error }`.
- Consumer: orchestrator.

- [ ] **Step 1: Write failing adapter tests with injected dependencies**

Test profile mode: existing `buildDiscoverySearchPlan` + `searchLinkedInProfile` are called and jobs receive LinkedIn provenance.

Test legacy mode: when no union plan exists, delegate to the existing legacy LinkedIn search dependency instead of inventing a new profile or silently dropping current fallback behavior.

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test app/lib/linkedin-source-adapter.test.mjs`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter as delegation only**

Profile path:

```js
const discoverySearchPlan = await buildDiscoverySearchPlan({ unionSearchPlan })
const result = await searchLinkedInProfile({
  freshnessDays,
  unionSearchPlan: discoverySearchPlan,
  exclusionRules,
  fetcher: createLinkedInStableFetcher(),
})
```

Legacy path must invoke the same underlying behavior currently used by `/api/linkedin-search`; do not duplicate or alter its scoring/search algorithm.

Normalize returned jobs with `sourceRecords: [{ source:'linkedin', sourceJobId, detailUrl, applicationUrl, fullJd }]`.

- [ ] **Step 4: Verify existing LinkedIn regression tests remain green**

Run: `npm test`

Expected: all existing LinkedIn pagination/query-expansion/audit tests PASS unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/lib/linkedin-source-adapter.js app/lib/linkedin-source-adapter.test.mjs
git commit -m "feat: wrap existing LinkedIn search as source adapter"
```

---

### Task 5: Production Jobindex HTML Parser

**Files:**
- Create: `app/lib/jobindex-parser.js`
- Create: `app/lib/jobindex-parser.test.mjs`

**Interfaces:**
- Produces: `extractJobindexSearchRecords(html)`, `extractJobindexDetail(html, context)`, `jobindexDetailUrl(jobId)`.
- Consumer: Jobindex source adapter.

- [ ] **Step 1: Capture minimal sanitized HTML fixtures directly inside tests**

Use small fixture strings representing the verified Jobindex structures needed to extract stable `h...` IDs and canonical detail links. Do not depend on live Jobindex network calls in unit tests.

- [ ] **Step 2: Write failing parser tests**

Required cases:

- stable IDs such as `h1693319` are extracted once
- unrelated `href`s are ignored
- `/vis-job/h...` canonical detail URL is produced
- title/company/location/date/application link are returned when present
- detail parser extracts full JD text when a supported structured/semantic content block is present
- missing optional fields return empty/null values rather than throwing

- [ ] **Step 3: Run parser test and verify failure**

Run: `node --test app/lib/jobindex-parser.test.mjs`

Expected: FAIL because parser module does not exist.

- [ ] **Step 4: Implement parser using robust document/embedded-data signals first**

Prefer stable embedded structured data or semantic attributes found in current Jobindex HTML. Avoid a design dependent on positional CSS classes or visual layout. Parse HTML as text with narrowly scoped extraction helpers because no HTML DOM dependency is currently installed; do not add a parser dependency unless live fixtures prove it necessary.

- [ ] **Step 5: Run parser tests**

Run: `node --test app/lib/jobindex-parser.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/jobindex-parser.js app/lib/jobindex-parser.test.mjs
git commit -m "feat: parse Jobindex search and detail records"
```

---

### Task 6: Jobindex Source Adapter, Pagination, Filters, and Full JD

**Files:**
- Create: `app/lib/jobindex-source-adapter.js`
- Create: `app/lib/jobindex-source-adapter.test.mjs`
- Reuse: `app/lib/jobindex-parser.js`, `app/lib/normalized-job.js`

**Interfaces:**
- Produces: `searchJobindexSource({ freshnessDays, unionSearchPlan, exclusionRules, filters, fetcher })`.
- Returns: `{ source:'jobindex', status, jobs, stats, error }`.
- Consumer: orchestrator.

- [ ] **Step 1: Write failing tests using a fake fetcher**

Cover:

- union Search Profile directions produce Jobindex searches
- page 1 and `page=2` are requested and distinct stable IDs are accumulated
- pagination stops when a page yields no new IDs or an empty record set
- detail pages use `/vis-job/<jobId>`
- one detail failure does not fail the whole Jobindex batch
- freshness and common location/work-model semantics are applied before a record enters the common pipeline
- output jobs conform to the normalized contract and include Jobindex provenance

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test app/lib/jobindex-source-adapter.test.mjs`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement query construction from existing union Search Profile directions**

For each approved direction, use the direction's actual discovery query when present, otherwise its role text. Do not create a second source-specific Search Profile or run a second AI expansion just for Jobindex.

Construct Jobindex URLs with `URL`/`URLSearchParams`, e.g. base `/jobsoegning` with `q=<query>` and `page=<n>` for subsequent pages.

- [ ] **Step 4: Implement conservative pagination**

Start at page 1, then page 2+ only while new IDs continue. Add a finite maximum page limit in adapter configuration to prevent runaway requests. The initial maximum should be selected from TEST evidence, not copied blindly from LinkedIn's four-page rule.

- [ ] **Step 5: Implement detail fetching and normalization**

For each unique Jobindex ID, fetch the canonical detail page, combine search-page metadata with detail metadata, and normalize to the common contract.

If detail fetch fails, retain the search record with `fullJd:''` and a limited-data marker in the source record; do not silently drop it.

- [ ] **Step 6: Apply existing common filter semantics**

Reuse existing ApplyPilot classification/filter helpers where possible rather than implementing Jobindex-only interpretations. The adapter may use Jobindex query parameters to reduce volume, but final inclusion must follow ApplyPilot's common freshness/location/work-model semantics.

- [ ] **Step 7: Run focused tests**

Run: `node --test app/lib/jobindex-parser.test.mjs app/lib/jobindex-source-adapter.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/lib/jobindex-source-adapter.js app/lib/jobindex-source-adapter.test.mjs
git commit -m "feat: add Jobindex source adapter"
```

---

### Task 7: Multi-Source Orchestrator With Partial Failure Isolation

**Files:**
- Create: `app/lib/search-source-orchestrator.js`
- Create: `app/lib/search-source-orchestrator.test.mjs`

**Interfaces:**
- Consumes: `enabledSources`, shared search input, LinkedIn adapter, Jobindex adapter.
- Produces: `runMultiSourceSearch(input, dependencies)` returning `{ jobs, sourceStatuses, stats, coverage, audit }`.
- Consumer: `/api/multi-source-search` route.

- [ ] **Step 1: Write failing orchestration tests**

Required cases:

- only enabled source adapters are called
- LinkedIn-only succeeds
- Jobindex-only succeeds
- both run concurrently
- LinkedIn failure + Jobindex success returns Jobindex jobs plus LinkedIn failed status
- Jobindex failure + LinkedIn success returns LinkedIn jobs plus Jobindex failed status
- both fail returns no jobs and an aggregate failure status
- results pass through `dedupeJobs`
- merged duplicate retains both provenance records

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test app/lib/search-source-orchestrator.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement independent source execution with `Promise.allSettled`**

Do not let a rejection from one adapter reject the entire orchestration promise. Convert each settled result into the standard source status shape.

- [ ] **Step 4: Add source-local timeouts without shared cancellation**

Wrap each adapter independently so a slow Jobindex request cannot cancel a successful LinkedIn result and vice versa. Keep retries source-local and conservative.

- [ ] **Step 5: Normalize, flatten, dedupe, and aggregate status**

Only successful/partial source job arrays enter `dedupeJobs`. Preserve per-source stats. Do not expose stack traces or internal error objects to the UI.

- [ ] **Step 6: Run focused tests**

Run: `node --test app/lib/search-source-orchestrator.test.mjs app/lib/cross-source-dedupe.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/lib/search-source-orchestrator.js app/lib/search-source-orchestrator.test.mjs
git commit -m "feat: orchestrate independent job search sources"
```

---

### Task 8: Authenticated Multi-Source API Route

**Files:**
- Create: `app/api/multi-source-search/route.js`
- Reuse: `app/lib/auth/require-user.js`, source adapters, orchestrator.

**Interfaces:**
- Request body: `{ freshnessDays, unionSearchPlan, exclusionRules, cvText, enabledSources, filters }`.
- Response: `{ jobs, sourceStatuses, stats, coverage, audit, fetchedAt }`.

- [ ] **Step 1: Implement route validation using existing auth pattern**

Mirror the authentication/runtime pattern of `app/api/linkedin-profile-search/route.js`:

```js
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
```

Require the current user before search execution.

- [ ] **Step 2: Validate enabled sources and zero-source requests server-side**

Return HTTP 400 with `Select at least one search source.` if normalization produces an empty list. Never rely only on client validation.

- [ ] **Step 3: Preserve current no-Search-Profile LinkedIn fallback without inventing Jobindex profile data**

If `unionSearchPlan.directions` is absent/empty:

- LinkedIn may use the existing legacy CV-based path through the LinkedIn adapter, preserving current behavior.
- Jobindex must not fabricate roles from CV text. Mark Jobindex as skipped/unavailable for that run with a concise reason that Search Profile is required for Jobindex discovery.

This is a compatibility bridge only; it does not alter Search Profile logic.

- [ ] **Step 4: Invoke `runMultiSourceSearch` and return fail-soft response**

If at least one source succeeds/partially succeeds, return HTTP 200 with jobs and `sourceStatuses` even when another source failed.

If every selected source fails before producing usable output, return an error response with a generic user-safe message and source statuses for diagnostics.

- [ ] **Step 5: Run all unit tests and production build**

Run:

```bash
npm test
npm run build
```

Expected: tests PASS; Next.js build compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add app/api/multi-source-search/route.js
git commit -m "feat: add authenticated multi-source search API"
```

---

### Task 9: Main-Screen `SEARCH SOURCES` UI and Combined Search Flow

**Files:**
- Modify: `app/page.js`
- Modify: `app/globals.css` only if needed for compact layout.

**Interfaces:**
- Consumes: persisted source selection and `/api/multi-source-search`.
- Displays: `LinkedIn`, `Jobindex`, or `LinkedIn · Jobindex` from normalized provenance.

- [ ] **Step 1: Add compact equal source controls to the main search controls**

Approved UI:

```text
SEARCH SOURCES
☑ LinkedIn
☑ Jobindex
```

No `PRIMARY` label. Do not hide this in Settings.

Use accessible labeled checkboxes and the persisted state from Task 1.

- [ ] **Step 2: Replace source-specific search button/loading copy**

Change `Search LinkedIn` to `Search` and `Reading LinkedIn JDs…` to source-neutral copy such as `Searching…` so the UI remains correct for Jobindex-only and combined searches.

- [ ] **Step 3: Route search requests through `/api/multi-source-search`**

Send:

```js
{
  freshnessDays,
  unionSearchPlan: profile.unionSearchPlan,
  exclusionRules: Array.isArray(profile.exclusionRules) ? profile.exclusionRules : [],
  cvText: cvData.cvText,
  enabledSources: selectedSources,
  filters: {
    areas: selectedAreas,
    workModels: selectedWorkModels,
  },
}
```

Keep the existing local result filters as a defensive/presentation layer; do not remove them in this feature.

- [ ] **Step 4: Render source provenance from `sourceRecords`**

Replace any hard-coded LinkedIn result source display with `sourceLabel(job)` or equivalent normalized display logic.

Expected visible values are exactly:

- `LinkedIn`
- `Jobindex`
- `LinkedIn · Jobindex`

- [ ] **Step 5: Add concise partial-source warning**

If one selected source failed while another returned results, render only a compact human-readable warning such as:

`Jobindex search unavailable`

Do not expose `timeout`, stack traces, adapter states, or raw HTTP errors in the normal UI.

If everything succeeds, show no warning.

- [ ] **Step 6: Update source-specific hero/header copy only where it would become factually wrong**

The current page contains source-specific language such as `LINKEDIN · PUBLIC`, `ONE SOURCE · END-TO-END`, and `Search Profile → LinkedIn discovery...`. Replace only wording that becomes false under multi-source search; keep visual design and unrelated copy unchanged.

- [ ] **Step 7: Build and manually inspect main-screen behavior locally/TEST**

Verify:

- default shows both checked for a clean storage state
- toggling persists after reload
- zero selected prevents search
- LinkedIn-only request contains only LinkedIn
- Jobindex-only request contains only Jobindex
- both selected requests both
- source display renders combined provenance correctly

- [ ] **Step 8: Commit**

```bash
git add app/page.js app/globals.css
git commit -m "feat: expose selectable job search sources"
```

---

### Task 10: Regression, Failure, and TEST Acceptance Verification

**Files:**
- Modify tests only if a real uncovered requirement is found.
- Do not alter implementation merely to make expected counts stable across LinkedIn runs.

**Interfaces:**
- Verifies the complete approved spec before TEST review.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: all tests PASS. Record exact pass count; do not claim a count before observing it.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: `Compiled successfully` and successful Next.js build completion.

- [ ] **Step 3: Verify LinkedIn-only regression**

On TEST, select only LinkedIn and run an existing known Search Profile/freshness scenario. Compare behavior to the pre-feature baseline using control vacancies/job IDs rather than raw total result count.

Acceptance: existing LinkedIn discovery/query-expansion/pagination behavior remains intact.

- [ ] **Step 4: Verify Jobindex-only acquisition**

On TEST, select only Jobindex.

Verify from diagnostics/network output:

- Jobindex search HTTP success
- more than one page where available
- stable `h...` IDs
- canonical `/vis-job/h...` detail fetch
- normalized title/company/location/date fields where present
- full JD extraction for at least one real vacancy
- limited-data retention when a detail fetch is intentionally failed or unavailable

- [ ] **Step 5: Verify combined run and conservative dedupe**

Select both sources. Identify at least one obvious cross-source duplicate if available.

Acceptance:

- obvious duplicate becomes one card with `LinkedIn · Jobindex`
- uncertain similar vacancies remain separate
- no attempt is made to tune duplicate volume during this first acceptance pass

- [ ] **Step 6: Verify partial failure behavior**

In TEST only, inject/mock one source failure at a controlled boundary.

Acceptance:

- failed source warning is visible
- successful source results remain usable
- search does not become a total failure

- [ ] **Step 7: Verify source persistence and Search Profile isolation**

Change selected sources, reload, and verify selection persists. Inspect stored profile and source-selection keys separately.

Acceptance: changing sources does not modify `applypilot-profile`, roles, exclusions, geography, or Search Profile fingerprints.

- [ ] **Step 8: Verify diff scope**

Compare feature branch to its base and confirm no unrelated Search Profile/evaluator refactor or production probe route was introduced.

- [ ] **Step 9: Publish TEST only**

Deploy the feature branch to TEST/preview. Do not merge to `main` and do not change the production alias.

- [ ] **Step 10: Present TEST evidence for user review**

Report:

- feature branch HEAD
- exact automated test count and result
- build result
- TEST deployment URL/status
- LinkedIn-only control outcome
- Jobindex-only outcome
- combined-source/dedupe outcome
- partial-failure outcome
- files changed summary
- explicit statement that `main` remains untouched

Only after explicit user approval should a separate merge-to-LIVE step be considered.
