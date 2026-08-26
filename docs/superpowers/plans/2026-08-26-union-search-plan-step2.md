# Union Search Plan Step 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile the user-edited multi-CV role lists into a deterministic Union Search Plan, preview it on the existing Confirm step, and save it without connecting it to the current LinkedIn Search Engine.

**Architecture:** Add one pure compiler module that treats the edited Primary/Adjacent lists as canonical and enriches them with Step 1 provenance. Page wiring derives the plan from draft state with `useMemo`, passes it to a compact preview component, and saves the current snapshot. Current Search request and frozen Search core remain untouched.

**Tech Stack:** Next.js client component, React, ES modules, Node built-in test runner, existing localStorage Search Profile flow.

**Spec:** `docs/superpowers/specs/2026-08-26-union-search-plan-step2-design.md`

## Global Constraints

- Work only on `feature/cv-library-3-slots`.
- Do not modify `main`.
- Do not modify `app/lib/linkedin-search.js` or `app/lib/linkedin-stable-search.js`.
- Do not change `/api/linkedin-search` payload or behavior.
- Do not add any AI call.
- User-edited Primary/Adjacent lists are canonical.
- No new wizard step.

---

### Task 1: Pure Union Search Plan compiler

**Files:**
- Create: `app/lib/union-search-plan.js`
- Create: `app/lib/union-search-plan.test.mjs`

**Interfaces:**
- Consumes: `{ primaryRoles, adjacentRoles, roleSources, cvRoleProfiles }`
- Produces: `UNION_SEARCH_PLAN_VERSION` and `buildUnionSearchPlan(input)` returning `{version,fingerprint,primaryCount,adjacentCount,totalCount,directions}`.

- [ ] **Step 1: Write failing compiler tests**

Cover:

```js
const plan=buildUnionSearchPlan({
  primaryRoles:['Senior IT Project Manager','Execution Lead'],
  adjacentRoles:[' execution   lead ','Release Manager'],
  roleSources:[{
    role:'Senior IT Project Manager',
    cvIds:['cv-1','cv-2'],
    support:[{cvId:'cv-1',kind:'primary'},{cvId:'cv-2',kind:'adjacent'}]
  }],
  cvRoleProfiles:[{cvId:'cv-1',slot:1},{cvId:'cv-2',slot:2}]
})

assert.deepEqual(plan.directions.map(x=>[x.role,x.tier,x.origin]),[
  ['Senior IT Project Manager','primary','cv'],
  ['Execution Lead','primary','manual'],
  ['Release Manager','adjacent','manual']
])
```

Also test removed raw role absence, provenance slots, retiering with original support kind, empty plan, and fingerprint stability/change.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test app/lib/union-search-plan.test.mjs
```

Expected: FAIL because `union-search-plan.js` does not exist.

- [ ] **Step 3: Implement minimal pure compiler**

Implement normalization equivalent to Step 1 role normalization:

```js
const text=value=>String(value??'').replace(/\s+/g,' ').trim()
const key=value=>text(value).toLowerCase()
export const UNION_SEARCH_PLAN_VERSION='union-search-plan-v1'
```

Compiler rules:

```js
export function buildUnionSearchPlan({primaryRoles=[],adjacentRoles=[],roleSources=[],cvRoleProfiles=[]}={}){
  // clean/dedupe user lists
  // Primary wins over Adjacent
  // lookup provenance by normalized role key
  // origin=cv only when provenance exists; otherwise manual
  // map cvIds to slots from cvRoleProfiles
  // preserve raw support kinds from Step 1
  // build deterministic fingerprint from version + ordered tier/key + provenance
}
```

Do not import browser APIs, React, OpenAI clients, or Search code.

- [ ] **Step 4: Run compiler tests and verify GREEN**

```bash
node --test app/lib/union-search-plan.test.mjs
```

Expected: all Step 2 compiler tests pass.

- [ ] **Step 5: Commit**

Commit message:

```text
feat: compile union search plan from edited roles
```

---

### Task 2: Compact Search Plan preview

**Files:**
- Create: `app/components/search-plan-preview.js`
- Create: `app/lib/union-search-plan-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `plan` from `buildUnionSearchPlan`.
- Produces: a non-interactive Confirm-step preview. No new state and no actions.

- [ ] **Step 1: Write failing UI contract test**

The test reads the component source and asserts stable contract strings/fields exist:

```js
assert.match(source,/SEARCH PLAN PREVIEW/)
assert.match(source,/plan\.directions/)
assert.match(source,/PRIMARY/)
assert.match(source,/ADJACENT/)
assert.match(source,/MANUAL/)
assert.match(source,/cvSlots/)
```

- [ ] **Step 2: Run test and verify RED**

```bash
node --test app/lib/union-search-plan-ui-contract.test.mjs
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement preview component**

Render:

```jsx
<div className="truth">
  <b>SEARCH PLAN PREVIEW · {plan.totalCount} DIRECTIONS</b>
  <span>{plan.primaryCount} primary · {plan.adjacentCount} adjacent</span>
  {plan.directions.map(direction=>(
    <div key={`${direction.tier}:${direction.key}`}>
      <b>{direction.role}</b>
      <span>{direction.tier==='primary'?'PRIMARY':'ADJACENT'} · {direction.origin==='manual'?'MANUAL':direction.cvSlots.map(slot=>`CV ${slot}`).join(' · ')}</span>
    </div>
  ))}
</div>
```

Use existing visual primitives/classes where possible; no new navigation or modal.

- [ ] **Step 4: Run UI contract test and verify GREEN**

```bash
node --test app/lib/union-search-plan-ui-contract.test.mjs
```

- [ ] **Step 5: Commit**

Commit message:

```text
feat: preview union search plan on confirm
```

---

### Task 3: Wire draft plan into Search Profile save flow

**Files:**
- Modify: `app/page.js`
- Create: `app/lib/union-search-plan-wiring.test.mjs`

**Interfaces:**
- Consumes: `draftPrimaryRoles`, `draftAdjacentRoles`, `draft.roleSources`, `draft.cvRoleProfiles`.
- Produces: `draftUnionSearchPlan`, Confirm preview prop, and saved profile fields `unionSearchPlan`, `unionSearchPlanVersion`, `unionSearchPlanFingerprint`.

- [ ] **Step 1: Write failing wiring contract test**

Assert `page.js` contains:

```js
import {buildUnionSearchPlan,UNION_SEARCH_PLAN_VERSION} from './lib/union-search-plan.js'
```

and a memoized draft plan using the edited lists:

```js
buildUnionSearchPlan({
  primaryRoles:draftPrimaryRoles,
  adjacentRoles:draftAdjacentRoles,
  roleSources:draft.roleSources,
  cvRoleProfiles:draft.cvRoleProfiles
})
```

Assert save writes all three plan fields and Confirm renders `<SearchPlanPreview plan={draftUnionSearchPlan}/>`.

Also assert the old Search payload remains:

```js
JSON.stringify({freshnessDays,cvText:cvData.cvText})
```

and contains no `unionSearchPlan` in that request expression.

- [ ] **Step 2: Run wiring contract and verify RED**

```bash
node --test app/lib/union-search-plan-wiring.test.mjs
```

- [ ] **Step 3: Wire compiler and preview into `page.js`**

Add imports:

```js
import {buildUnionSearchPlan,UNION_SEARCH_PLAN_VERSION} from './lib/union-search-plan.js'
import SearchPlanPreview from './components/search-plan-preview.js'
```

Derive:

```js
const draftUnionSearchPlan=useMemo(()=>buildUnionSearchPlan({
  primaryRoles:draftPrimaryRoles,
  adjacentRoles:draftAdjacentRoles,
  roleSources:Array.isArray(draft.roleSources)?draft.roleSources:[],
  cvRoleProfiles:Array.isArray(draft.cvRoleProfiles)?draft.cvRoleProfiles:[]
}),[draftPrimaryRoles,draftAdjacentRoles,draft.roleSources,draft.cvRoleProfiles])
```

When constructing the saved profile object, include:

```js
unionSearchPlan:draftUnionSearchPlan,
unionSearchPlanVersion:UNION_SEARCH_PLAN_VERSION,
unionSearchPlanFingerprint:draftUnionSearchPlan.fingerprint
```

Render the preview only on current Step 5.

Do not modify `search()`.

- [ ] **Step 4: Run targeted Step 2 tests**

```bash
node --test app/lib/union-search-plan.test.mjs app/lib/union-search-plan-ui-contract.test.mjs app/lib/union-search-plan-wiring.test.mjs
```

Expected: all pass.

- [ ] **Step 5: Commit**

Commit message:

```text
feat: save union search plan snapshot
```

---

### Task 4: Regression and build verification

**Files:**
- No permanent production file expected beyond Tasks 1–3.
- A temporary TEST-only GitHub Actions workflow may be created and deleted if Vercel/build execution is otherwise unavailable.

**Interfaces:**
- Verifies frozen Search boundary and production compilation.

- [ ] **Step 1: Compare Search core blob SHAs to pre-Step-2 baseline**

Expected unchanged:

```text
app/lib/linkedin-search.js = e9645404dbe647486bbb7ee1c4afd38a20f434f9
app/lib/linkedin-stable-search.js = 2843327af6465db84523d80dc09b51eff5c236d4
```

- [ ] **Step 2: Run Step 1 + Step 2 targeted tests**

```bash
node --test app/lib/search-profile-library.test.mjs app/lib/search-profile-cache.test.mjs app/lib/multi-cv-search-profile-contract.test.mjs app/lib/union-search-plan.test.mjs app/lib/union-search-plan-ui-contract.test.mjs app/lib/union-search-plan-wiring.test.mjs
```

- [ ] **Step 3: Run production build**

```bash
npm install --no-audit --no-fund
npm run build
```

Expected: successful Next.js production build.

- [ ] **Step 4: Verify `main` has not moved**

Expected main head before Step 2:

```text
354c799c8ffe31e599f175ae4770ae4086a73a91
```

- [ ] **Step 5: Stop after Step 2**

Do not implement shadow/profile-driven discovery. Report TEST head, test/build evidence, Search core SHAs, and `main` head for manual user review.