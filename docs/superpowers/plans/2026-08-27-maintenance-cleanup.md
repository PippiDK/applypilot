# ApplyPilot Maintenance Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean proven dead Best CV selection code, stop automatic deployments from the active development branch, and bring repository documentation/backlog up to date without changing product behavior.

**Architecture:** Treat deployment hygiene, dead-code cleanup, and documentation as isolated maintenance units. Vercel configuration is declarative; dead-code cleanup uses a RED/GREEN export-surface contract; documentation is derived from the verified current branch and today's completed milestones.

**Tech Stack:** Next.js 14, React 18, Node.js built-in test runner, GitHub Actions, Vercel Git integration.

**Spec:** `docs/superpowers/specs/2026-08-27-maintenance-cleanup.md`

## Global Constraints

- Work only on `feature/cv-library-3-slots`.
- `main` must remain at `354c799c8ffe31e599f175ae4770ae4086a73a91`.
- Frozen LinkedIn Search core files must remain byte-identical.
- No functional Search/scoring/CV behavior changes.
- No new Vercel Preview deployment during maintenance.
- Delete only code proven dead by current usage and contract tests.

---

### Task 1: Deployment guard

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: Vercel Git integration branch name `feature/cv-library-3-slots`.
- Produces: branch-specific automatic deployment disablement while leaving unspecified branches on Vercel defaults.

- [ ] **Step 1: Add branch-specific Vercel Git configuration**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "feature/cv-library-3-slots": false
    }
  }
}
```

- [ ] **Step 2: Verify configuration from the branch**

Fetch `vercel.json` from `feature/cv-library-3-slots` and confirm the exact branch key is `false`.

- [ ] **Step 3: Verify Vercel did not create a new Preview deployment for the maintenance configuration commit**

Compare the project's deployment list before and after the commit. Any new deployment sourced from the maintenance commit is a blocker to investigate before further commits.

---

### Task 2: Remove obsolete Best CV selection persistence with TDD

**Files:**
- Modify: `app/lib/best-cv-cache.test.mjs`
- Modify: `app/lib/best-cv-cache.js`
- Temporary verification: `.github/workflows/maintenance-tdd.yml`

**Interfaces:**
- Keeps: `bestCvCacheKey`, `readBestCvCache`, `writeBestCvCache`.
- Removes: `readBestCvSelection`, `writeBestCvSelection` and their private selection-key support.

- [ ] **Step 1: Write the failing export-surface test**

Add this test to `app/lib/best-cv-cache.test.mjs` before touching production code:

```js
import * as bestCvCache from './best-cv-cache.js'

test('Best CV cache exposes analysis persistence only, not obsolete user-selection persistence',()=>{
  assert.equal('readBestCvSelection' in bestCvCache,false)
  assert.equal('writeBestCvSelection' in bestCvCache,false)
})
```

Keep the existing analysis-cache tests unchanged.

- [ ] **Step 2: Run targeted test and verify RED**

Run:

```bash
node --test app/lib/best-cv-cache.test.mjs
```

Expected: FAIL because both obsolete exports still exist.

- [ ] **Step 3: Remove minimal dead production code**

From `app/lib/best-cv-cache.js`, delete only:

```js
const SELECTION_PREFIX=`applypilot-best-cv-selection:${SELECTOR_VERSION}`
```

and the `selectionKey`, `readBestCvSelection`, and `writeBestCvSelection` functions. Do not alter Best CV analysis cache keying or read/write behavior.

- [ ] **Step 4: Run targeted test and verify GREEN**

Run:

```bash
node --test app/lib/best-cv-cache.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run full regression and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 3: Refresh repository documentation and backlog

**Files:**
- Modify: `README.md`
- Create: `docs/BACKLOG.md`
- Create: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: current TEST branch product state and verified 2026-08-26 milestone history.
- Produces: current architecture overview, living backlog, and dated delivery log.

- [ ] **Step 1: Replace obsolete single-milestone README**

Document the current product areas: public LinkedIn search, 3-slot CV Library, Search Profile, Union Search Plan, Shadow Search diagnostic, Best CV recommendation, Expertise Match, manual vacancy statuses, authentication, and frozen legacy Search-core rule.

- [ ] **Step 2: Create living backlog**

Use these sections exactly:

```text
NEXT
PLANNED
UX OBSERVATION
TECH DEBT
```

Include AI CV Adaptation, Persistent Job Analysis, eventual filtering/sorting after UX evidence, search-direction normalization, and legacy/root-file audit. Do not mark unimplemented items as shipped.

- [ ] **Step 3: Create dated changelog**

Under `2026-08-26`, record completed features/tasks/bug fixes: Multi-CV Search Profiles, Union Search Plan, profile-driven Shadow Discovery, informational Best CV panel, persistent manual vacancy statuses, factual cards moved upward, Search Profile summary clarification, dynamic 17/8/9 direction summary, Audit Log relocation/styling, test coverage, and the Vercel Preview deployment incident/cleanup.

Under `2026-08-27`, record this maintenance pass only after its corresponding changes are committed and verified.

---

### Task 4: Final verification and cleanup

**Files:**
- Delete temporary: `.github/workflows/maintenance-tdd.yml`
- Verify all maintenance files and frozen files.

**Interfaces:**
- Produces: clean TEST branch with no temporary CI helper and no product behavior change.

- [ ] **Step 1: Run final verifier**

The temporary GitHub Actions job must execute:

```bash
node --test app/lib/best-cv-cache.test.mjs
npm test
npm run build
```

It must additionally compare frozen Search file blob SHAs and assert `main` remains `354c799c8ffe31e599f175ae4770ae4086a73a91`.

- [ ] **Step 2: Remove temporary verifier workflow**

Delete `.github/workflows/maintenance-tdd.yml` after a successful run.

- [ ] **Step 3: Verify final branch diff**

Final maintenance changes may include only `vercel.json`, Best CV cache/test cleanup, README, docs, and removal of the temporary verifier. Frozen Search files must not appear in the diff.

- [ ] **Step 4: Verify no maintenance deployment**

Check Vercel deployment history again. No maintenance commit from `feature/cv-library-3-slots` should have produced a new Preview deployment.
