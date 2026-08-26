# Profile-Driven Shadow Discovery Step 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight Union Search Plan discovery in parallel with the frozen legacy LinkedIn Search and display a diagnostic discovery delta without affecting Live Matches.

**Architecture:** A new server-side shadow discovery module performs exactly one LinkedIn search-card request per approved direction and aggregates provenance. A separate pure comparison helper compares shadow IDs with the existing legacy Search Audit. A new authenticated endpoint exposes shadow results, while `page.js` launches legacy and shadow requests independently and renders a dedicated non-authoritative audit component.

**Tech Stack:** Next.js 14 App Router, React 18, Node.js `node:test`, existing LinkedIn stable fetcher/parser, GitHub Actions for branch verification.

**Spec:** `docs/superpowers/specs/2026-08-26-profile-shadow-discovery-step3-design.md`

## Global Constraints

- Implement only on `feature/cv-library-3-slots`; do not modify `main`.
- Do not modify `app/lib/linkedin-search.js`.
- Do not modify `app/lib/linkedin-stable-search.js`.
- Do not modify `app/lib/linkedin-role-gate.js`.
- Do not modify `app/api/linkedin-search/route.js`.
- Legacy Search request body remains `{freshnessDays,cvText:cvData.cvText}`.
- Shadow search never reads Full JD, never scores, and never changes Live Matches.
- One search-page request per approved direction, `start=0` only.
- No artificial cap on Union Search Plan directions.

---

### Task 1: Shadow discovery engine

**Files:**
- Test: `app/lib/linkedin-shadow-discovery.test.mjs`
- Create: `app/lib/linkedin-shadow-discovery.js`

**Interfaces:**
- Consumes: `parseSearchHtml(html)` from `./linkedin-search.js`; Union Search Plan `directions[]`; fetcher `(url) => Promise<string>`.
- Produces: `searchLinkedInShadow({freshnessDays=7,unionSearchPlan,fetcher}) -> Promise<{candidates,stats,coverage}>`.

- [ ] **Step 1: Write the failing test**

Create tests that assert exact URL parameters, one request per direction, deduplication, aggregated provenance, partial failures, all-failure error, and empty-plan zero network calls. The core fixture uses two directions and duplicate job ID `1111111111` in both HTML responses.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInShadow} from './linkedin-shadow-discovery.js'

const card=(id,title='Role',company='Company')=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">${company}</h4><span class="job-search-card__location">Copenhagen</span><time datetime="2026-08-26"></time></li>`
const plan={directions:[
  {key:'integration project manager',role:'Integration Project Manager',tier:'primary',origin:'cv',cvSlots:[1,3]},
  {key:'programme delivery manager',role:'Programme Delivery Manager',tier:'adjacent',origin:'manual',cvSlots:[]}
]}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test app/lib/linkedin-shadow-discovery.test.mjs
```

Expected: FAIL because `linkedin-shadow-discovery.js` does not exist.

- [ ] **Step 3: Implement minimal engine**

Implementation shape:

```js
import {parseSearchHtml} from './linkedin-search.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const WINDOWS=new Set([1,3,7,14])
const text=value=>String(value??'').trim()

function normalizeDirection(raw={}){
  const role=text(raw.role)
  if(!role) return null
  return {
    key:text(raw.key)||role.toLowerCase(),
    role,
    tier:raw.tier==='primary'?'primary':'adjacent',
    origin:raw.origin==='cv'?'cv':'manual',
    cvSlots:[...new Set((Array.isArray(raw.cvSlots)?raw.cvSlots:[]).map(Number).filter(n=>Number.isFinite(n)&&n>0))]
  }
}

export async function searchLinkedInShadow({freshnessDays=7,unionSearchPlan={},fetcher}={}){
  if(typeof fetcher!=='function') throw new Error('Shadow LinkedIn fetcher is required.')
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(normalizeDirection).filter(Boolean)
  if(!directions.length) return {candidates:[],stats:{directions:0,primaryDirections:0,adjacentDirections:0,searchRequests:0,searchFailures:0,searchRows:0,discovered:0},coverage:{status:'NO DIRECTIONS',detail:null}}
  // bounded worker pool, exactly one start=0 request per direction
  // aggregate rows by jobId and append unique foundBy entries
  // tolerate partial failures; throw when failures === requests
}
```

Use a small internal worker pool of 4; do not call `collectDiscoveryPasses` because Step 3 intentionally avoids repeated passes.

- [ ] **Step 4: Run tests to verify GREEN**

```bash
node --test app/lib/linkedin-shadow-discovery.test.mjs
```

Expected: all Step 3 engine tests PASS.

- [ ] **Step 5: Commit**

Commit engine + tests with `feat: add lightweight profile shadow discovery`.

---

### Task 2: Legacy delta comparison

**Files:**
- Test: `app/lib/shadow-search-compare.test.mjs`
- Create: `app/lib/shadow-search-compare.js`

**Interfaces:**
- Consumes: `{candidates,legacyAudit}`.
- Produces: `compareShadowToLegacy({candidates=[],legacyAudit=[]})` with `totalCandidates`, `alreadyDiscovered`, `newCount`, `newFromPrimary`, `newFromAdjacent`, `newCandidates`.

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {compareShadowToLegacy} from './shadow-search-compare.js'

test('compares against all legacy audit IDs and partitions new candidates without double counting',()=>{
  const result=compareShadowToLegacy({
    legacyAudit:[{jobId:'1'},{jobId:'2'}],
    candidates:[
      {jobId:'1',foundBy:[{tier:'primary'}]},
      {jobId:'3',foundBy:[{tier:'primary'},{tier:'adjacent'}]},
      {jobId:'4',foundBy:[{tier:'adjacent'}]}
    ]
  })
  assert.equal(result.alreadyDiscovered,1)
  assert.equal(result.newCount,2)
  assert.equal(result.newFromPrimary,1)
  assert.equal(result.newFromAdjacent,1)
  assert.deepEqual(result.newCandidates.map(x=>x.jobId),['3','4'])
})
```

- [ ] **Step 2: Verify RED**

```bash
node --test app/lib/shadow-search-compare.test.mjs
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement minimal pure helper**

Use `String(jobId).trim()`, a Set of all legacy audit IDs, stable candidate order, and Primary priority for category partitioning.

- [ ] **Step 4: Verify GREEN**

```bash
node --test app/lib/shadow-search-compare.test.mjs
```

- [ ] **Step 5: Commit**

Commit with `feat: compare shadow discovery with legacy audit`.

---

### Task 3: Authenticated shadow endpoint

**Files:**
- Test: `app/lib/linkedin-shadow-route-contract.test.mjs`
- Create: `app/api/linkedin-shadow-search/route.js`

**Interfaces:**
- POST body: `{freshnessDays,unionSearchPlan}`.
- Response: shadow engine result plus `fetchedAt`.

- [ ] **Step 1: Write failing route contract test**

Read route source as text and assert it imports `requireUser`, `createLinkedInStableFetcher`, and `searchLinkedInShadow`; does not contain `searchLinkedInStable`; validates `[1,3,7,14]`; passes only `freshnessDays`, `unionSearchPlan`, `fetcher` to the shadow engine.

- [ ] **Step 2: Verify RED**

```bash
node --test app/lib/linkedin-shadow-route-contract.test.mjs
```

- [ ] **Step 3: Implement route**

```js
import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createLinkedInStableFetcher} from '../../lib/linkedin-stable-fetcher.js'
import {searchLinkedInShadow} from '../../lib/linkedin-shadow-discovery.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const unionSearchPlan=body?.unionSearchPlan&&typeof body.unionSearchPlan==='object'?body.unionSearchPlan:{directions:[]}
    const result=await searchLinkedInShadow({freshnessDays,unionSearchPlan,fetcher:createLinkedInStableFetcher()})
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('linkedin-shadow-search error',error)
    return NextResponse.json({error:String(error?.message||'LinkedIn shadow search failed')},{status:502})
  }
}
```

- [ ] **Step 4: Verify GREEN**

```bash
node --test app/lib/linkedin-shadow-route-contract.test.mjs app/lib/linkedin-shadow-discovery.test.mjs
```

- [ ] **Step 5: Commit**

Commit with `feat: expose authenticated shadow discovery endpoint`.

---

### Task 4: Shadow diagnostic component

**Files:**
- Test: `app/lib/shadow-search-audit-ui-contract.test.mjs`
- Create: `app/components/shadow-search-audit.js`

**Interfaces:**
- Props: `shadowState` containing `status`, `error`, `stats`, `comparison`, `coverage`.

- [ ] **Step 1: Write failing static UI contract test**

Assert component source contains `SHADOW SEARCH`, `no effect on Live matches`, labels for Directions, New candidates, Primary, Adjacent-only, and renders `FOUND BY` provenance from `comparison.newCandidates`.

- [ ] **Step 2: Verify RED**

```bash
node --test app/lib/shadow-search-audit-ui-contract.test.mjs
```

- [ ] **Step 3: Implement component**

Use a `<details>` diagnostic block. Render nothing for `idle`/`skipped`; render a compact error-only shadow panel for `error`; render counts and new-candidate rows for `ready`. Do not reuse or mutate `SearchAudit`.

- [ ] **Step 4: Verify GREEN**

```bash
node --test app/lib/shadow-search-audit-ui-contract.test.mjs
```

- [ ] **Step 5: Commit**

Commit with `feat: add shadow discovery audit panel`.

---

### Task 5: Parallel page wiring with legacy isolation

**Files:**
- Test: `app/lib/profile-shadow-wiring.test.mjs`
- Modify: `app/page.js`

**Interfaces:**
- Existing legacy endpoint remains `/api/linkedin-search`.
- New endpoint `/api/linkedin-shadow-search` consumes saved `profile.unionSearchPlan` only.
- Uses `compareShadowToLegacy` and `ShadowSearchAudit`.

- [ ] **Step 1: Write failing wiring test**

Static assertions on `page.js`:

- legacy request still includes exact `JSON.stringify({freshnessDays,cvText:cvData.cvText})`;
- imports `compareShadowToLegacy` and `ShadowSearchAudit`;
- has independent `shadowState`;
- shadow payload is `JSON.stringify({freshnessDays,unionSearchPlan:profile.unionSearchPlan})`;
- shadow request is started before awaiting legacy result;
- `setJobs` only receives legacy `data.jobs`, never shadow candidates;
- `setState` legacy error path does not reference shadow error;
- renders `<ShadowSearchAudit shadowState={shadowState}/>` after existing `<SearchAudit audit={state.audit}/>`.

- [ ] **Step 2: Verify RED**

```bash
node --test app/lib/profile-shadow-wiring.test.mjs
```

- [ ] **Step 3: Modify `page.js` minimally**

Add imports:

```js
import {compareShadowToLegacy} from './lib/shadow-search-compare.js'
import ShadowSearchAudit from './components/shadow-search-audit.js'
```

Add state:

```js
const [shadowState,setShadowState]=useState({status:'idle',error:'',stats:null,coverage:null,comparison:null})
```

Inside `search()` after CV guard and before the legacy `try`, start shadow independently only when `profile.unionSearchPlan?.directions?.length`:

```js
setShadowState({status:'idle',error:'',stats:null,coverage:null,comparison:null})
const shadowPlan=profile?.unionSearchPlan
const shadowPromise=Array.isArray(shadowPlan?.directions)&&shadowPlan.directions.length
  ? fetch('/api/linkedin-shadow-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({freshnessDays,unionSearchPlan:profile.unionSearchPlan})})
      .then(async res=>{const data=await res.json(); if(!res.ok) throw new Error(data.error||'LinkedIn shadow search failed'); return data})
      .catch(error=>({__shadowError:error.message||'LinkedIn shadow search failed'}))
  : Promise.resolve(null)
```

Keep the existing legacy fetch payload unchanged. After legacy `data` arrives and updates `jobs/state`, resolve shadow independently:

```js
shadowPromise.then(shadow=>{
  if(!shadow){setShadowState({status:'skipped',error:'',stats:null,coverage:null,comparison:null});return}
  if(shadow.__shadowError){setShadowState({status:'error',error:shadow.__shadowError,stats:null,coverage:null,comparison:null});return}
  setShadowState({status:'ready',error:'',stats:shadow.stats||null,coverage:shadow.coverage||null,comparison:compareShadowToLegacy({candidates:Array.isArray(shadow.candidates)?shadow.candidates:[],legacyAudit:Array.isArray(data.audit)?data.audit:[]})})
})
```

Render the new panel directly after existing `SearchAudit`.

- [ ] **Step 4: Verify GREEN**

```bash
node --test app/lib/profile-shadow-wiring.test.mjs app/lib/shadow-search-audit-ui-contract.test.mjs app/lib/shadow-search-compare.test.mjs
```

- [ ] **Step 5: Commit**

Commit with `feat: run profile discovery in shadow beside legacy search`.

---

### Task 6: Regression, frozen-core proof, and production build

**Files:**
- Temporary create/delete: `.github/workflows/step3-targeted-final.yml`
- No production code changes unless verification exposes a defect.

- [ ] **Step 1: Compare frozen core against Step 2 baseline**

Use GitHub compare/fetch evidence to confirm the four frozen files have no Step 3 changes.

- [ ] **Step 2: Create temporary verification workflow**

Workflow on pushes to `feature/cv-library-3-slots`:

```yaml
name: Step 3 Targeted Final
on:
  push:
    branches:
      - feature/cv-library-3-slots
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: package.json
      - run: npm install --no-audit --no-fund
      - name: Step 1 + Step 2 + Step 3 regression suite
        run: npm test
      - name: Production build
        run: npm run build
```

- [ ] **Step 3: Verify workflow PASS**

Read the actual GitHub Actions job status/logs. Do not infer success from code review.

- [ ] **Step 4: Confirm main SHA**

`main` must still equal `354c799c8ffe31e599f175ae4770ae4086a73a91`.

- [ ] **Step 5: Remove temporary workflow and confirm cleanup commit only removes workflow**

Delete `.github/workflows/step3-targeted-final.yml` after successful verification and fetch the cleanup commit diff.

- [ ] **Step 6: Final branch audit**

Compare Step 3 baseline `749e4ca4909ec5827ee97366ae711ee0b44c134c` to final TEST head. Expected product changes are docs, Step 3 tests/modules/endpoint/component, and minimal `page.js` wiring only. Frozen core remains untouched.
