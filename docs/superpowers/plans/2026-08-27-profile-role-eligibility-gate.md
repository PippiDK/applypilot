# Profile Role Eligibility Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic eligibility gate that rejects obvious non-target project/domain roles, holds ambiguous delivery roles out of the worthwhile shortlist, and preserves the current multilingual target-role recall and existing Search relevance scoring for eligible vacancies.

**Architecture:** Keep `evaluateProfileJob()` as the single evaluator entry point. Insert three pure eligibility checks before the existing Search Profile direction match: semantic user exclusions, professional role-family classification, and delivery-domain classification. Eligible jobs continue through the current direction matcher and current score unchanged; ambiguous jobs return `PROFILE_DOMAIN_AMBIGUOUS / HOLD`; non-target jobs return auditable reject stages.

**Tech Stack:** Next.js 14 / Node.js 24, ES modules, Node built-in test runner, existing deterministic LinkedIn profile evaluator.

**Spec:** `docs/superpowers/specs/2026-08-27-profile-role-eligibility-gate-design.md`

## Global Constraints

- Do not change Search Run persistence, Supabase schema, LinkedIn discovery pagination, Full-JD batching/continuation, deduplication, Search Profile construction, Union Search Plan, CV logic, or JD↔CV Expertise Match.
- Keep the current Search relevance scoring formula unchanged after eligibility passes.
- Preserve BUG #3 multilingual normalization and protected positive cases.
- Hard semantic exclusions are activated only by user-authored Search Profile exclusion rules; do not invent user exclusions.
- Physical construction/civil infrastructure and functional non-target domains are domain classification outcomes, not implicit user exclusions.
- No LLM/API calls in the eligibility gate.
- No hidden shortlist quota.
- `main` remains unchanged and Vercel deployment gate remains closed.

---

## File Structure

- Create `app/lib/profile-role-family.js` — pure professional-family classifier.
- Create `app/lib/profile-delivery-domain.js` — pure delivery-domain classifier with English/Danish evidence groups.
- Create `app/lib/profile-semantic-exclusions.js` — interprets only user-authored semantic exclusion categories such as R&D and ERP specialist roles.
- Modify `app/lib/linkedin-profile-evaluator.js` — orchestrates exclusions → role family → delivery domain → existing direction matcher/score.
- Create `app/lib/profile-eligibility-gate-regression.test.mjs` — focused live-run regression corpus for KEEP/REJECT/HOLD outcomes.
- Keep existing `app/lib/profile-role-confirmation-regression.test.mjs` as a BUG #3 safety net.

---

### Task 1: Lock the live-run behavior with RED regression tests

**Files:**
- Create: `app/lib/profile-eligibility-gate-regression.test.mjs`
- Read only: `app/lib/linkedin-profile-evaluator.js`

**Interfaces:**
- Consumes: `evaluateProfileJob({candidate, job, freshnessDays, exclusionRules, now})`.
- Produces: a regression contract for exact `decision`, `stage`, and KEEP/HOLD/REJECT behavior.

- [ ] **Step 1: Write fixtures for protected KEEP cases**

Use candidate `foundBy` directions and Full-JD text that explicitly establishes technology delivery:

```js
const keepCases = [
  {
    name: 'Ambu Senior IT Project Manager',
    candidate: {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job: job('Senior IT Project Manager','Lead enterprise IT platform and software delivery across systems, integrations, APIs and go-live.'),
  },
  {
    name: 'Atea Danish IT project manager',
    candidate: {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job: job('Senior IT-projektledere med teknisk indsigt','Drive IT-projekter, digitale løsninger, systemer, integrationer og tekniske leverancer.'),
  },
  {
    name: 'PET strategic IT projects',
    candidate: {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job: job('Kan du drive succesfulde strategiske IT projekter i PET?','Drive komplekse IT projekter, digitale systemer, platforme og leverancer på tværs af teams.'),
  },
  {
    name: 'Annapurna integration PM',
    candidate: {foundBy:[{role:'Integration Project Manager',tier:'adjacent'}]},
    job: job('Integration Project Manager','Lead API, middleware, system integration and enterprise application delivery.'),
  },
  {
    name: 'Twoday data platform modernisation',
    candidate: {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job: job('Senior Project Manager – Data Platform Modernisation','Lead cloud data platform, analytics, migration and technology delivery.'),
  },
  {
    name: 'Regionshospitalet digitalisation',
    candidate: {foundBy:[{role:'Digital Transformation Manager',tier:'primary'}]},
    job: job('Erfaren projektleder søges til kliniknær digitalisering','Drive digitalisering, digitale løsninger, IT-systemer and implementation across clinical teams.'),
  },
]
```

Assert every case remains `KEEP / KEPT` with a positive score.

- [ ] **Step 2: Write fixtures for protected false positives that must become REJECT**

```js
const rejectCases = [
  ['Roads and highways', {foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]}, job('Senior Project Manager - Roads and Highways','Lead road design, highways, civil engineering, construction and site delivery.'), [], 'PROFILE_DOMAIN_REJECT'],
  ['Mechanical construction', {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]}, job('Senior Mechanical Construction Project Manager - Data Centres','Lead mechanical construction, contractors, installation, commissioning and site works.'), [], 'PROFILE_DOMAIN_REJECT'],
  ['Finance only', {foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]}, job('Senior Finance Project Manager','Lead finance process, accounting, controlling and finance transformation with no technology delivery responsibility.'), [], 'PROFILE_DOMAIN_REJECT'],
  ['Regulatory affairs specialist', {foundBy:[{role:'Regulatory Project Manager',tier:'adjacent'}]}, job('Regulatory Affairs Specialist','Prepare regulatory submissions, compliance documentation and authority correspondence as a specialist.'), [], 'PROFILE_ROLE_FAMILY_REJECT'],
]
```

Assert `decision === 'REJECT'`, `keep === false`, and exact expected stage.

- [ ] **Step 3: Write semantic user-exclusion regressions**

```js
const erpRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'ERP specialist roles',originalText:'ERP specialist roles'}]
const rndRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'R&D roles',originalText:'R&D roles'}]
```

Assert a SAP S/4HANA Finance PM with the ERP rule and an Ambu Global R&D PM with the R&D rule both return `PROFILE_EXCLUSION_REJECT`. Assert the same textual jobs do not receive that stage when the corresponding user rule is absent.

- [ ] **Step 4: Write the HOLD regression**

```js
const ambiguous = evaluateProfileJob({
  candidate:{foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]},
  job:job('Senior Project Manager','Lead complex cross-functional initiatives, stakeholders, plans, risks and delivery.'),
  freshnessDays:7,
  exclusionRules:[],
  now:NOW,
})
assert.equal(ambiguous.keep,false)
assert.equal(ambiguous.decision,'HOLD')
assert.equal(ambiguous.stage,'PROFILE_DOMAIN_AMBIGUOUS')
assert.equal(ambiguous.score,null)
```

- [ ] **Step 5: Run the new regression test and verify RED**

Run:

```bash
node --test app/lib/profile-eligibility-gate-regression.test.mjs
```

Expected: existing evaluator incorrectly keeps at least roads/highways, finance/construction, regulatory specialist, and ambiguous generic PM cases.

- [ ] **Step 6: Commit only the RED test**

```bash
git add app/lib/profile-eligibility-gate-regression.test.mjs
git commit -m "test: lock profile eligibility gate regressions"
```

---

### Task 2: Add independent professional role-family classification

**Files:**
- Create: `app/lib/profile-role-family.js`
- Create: `app/lib/profile-role-family.test.mjs`

**Interfaces:**
- Produces: `classifyProfileRoleFamily(job) -> {family, evidence}`.
- Family values: `delivery-management`, `implementation-transformation`, `product`, `architecture`, `analysis`, `quality-test`, `software-builder`, `specialist`, `executive`, `other`.

- [ ] **Step 1: Write failing family-classifier tests**

Cover at minimum:

```js
assert.equal(classifyProfileRoleFamily({title:'Senior IT Project Manager',description:'...'}).family,'delivery-management')
assert.equal(classifyProfileRoleFamily({title:'Implementation Manager',description:'lead implementation and rollout'}).family,'implementation-transformation')
assert.equal(classifyProfileRoleFamily({title:'Regulatory Affairs Specialist',description:'regulatory submissions'}).family,'specialist')
assert.equal(classifyProfileRoleFamily({title:'Software Engineering Manager',description:'lead engineers'}).family,'software-builder')
assert.equal(classifyProfileRoleFamily({title:'Product Owner',description:'product roadmap'}).family,'product')
assert.equal(classifyProfileRoleFamily({title:'Enterprise Architect',description:'architecture'}).family,'architecture')
```

Add Danish `projektleder` and `programleder` delivery-family coverage.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test app/lib/profile-role-family.test.mjs
```

Expected: module not found / classifier undefined.

- [ ] **Step 3: Implement the minimal pure classifier**

Use normalized title-first evidence with a narrow description fallback. Resolve specific families before generic delivery words so `Regulatory Affairs Specialist` does not become delivery-management merely because a description mentions projects.

Export exactly:

```js
export function classifyProfileRoleFamily(job={}) {
  return {family, evidence}
}
```

The function must be deterministic and must not import Search Profile directions.

- [ ] **Step 4: Run family tests GREEN**

```bash
node --test app/lib/profile-role-family.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add app/lib/profile-role-family.js app/lib/profile-role-family.test.mjs
git commit -m "feat: classify profile role families"
```

---

### Task 3: Add delivery-domain classification with target / non-target / ambiguous outcomes

**Files:**
- Create: `app/lib/profile-delivery-domain.js`
- Create: `app/lib/profile-delivery-domain.test.mjs`

**Interfaces:**
- Produces: `classifyDeliveryDomain(job) -> {domain, evidence}`.
- Domain values: `TARGET_TECH`, `NON_TARGET_PHYSICAL`, `NON_TARGET_FUNCTIONAL`, `EXCLUDED_SPECIALISM`, `AMBIGUOUS`.

- [ ] **Step 1: Write failing domain tests**

Required evidence groups:

```js
TARGET_TECH: IT/software/platform/cloud/data/integration/digital/cyber/OT project-delivery evidence
NON_TARGET_PHYSICAL: construction/civil/roads/highways/buildings/mechanical/site/utility-infrastructure evidence
NON_TARGET_FUNCTIONAL: finance/accounting/HR/payroll/marketing/content/procurement/property/facilities/regulatory-affairs-only evidence
EXCLUDED_SPECIALISM: ERP/SAP specialist and R&D specialist evidence (classification only; user-rule precedence is Task 4)
AMBIGUOUS: generic project/delivery language without enough target or non-target domain evidence
```

Include English and Danish examples such as `byggeri`, `anlæg`, `projektering`, `entreprise`, `vej`, `digitalisering`, `IT-systemer`, `leverancer`, `integrationer`.

- [ ] **Step 2: Run tests RED**

```bash
node --test app/lib/profile-delivery-domain.test.mjs
```

- [ ] **Step 3: Implement evidence-group classifier**

Do not classify from one generic token. Count corroborating evidence groups. Title-specific domain evidence may count strongly, but `project`, `manager`, `senior`, `program`, `delivery` never count as domain evidence.

Use the following precedence when evidence is strong:

```text
EXCLUDED_SPECIALISM
NON_TARGET_PHYSICAL
TARGET_TECH
NON_TARGET_FUNCTIONAL
AMBIGUOUS
```

with a safety rule: strong explicit technology-delivery evidence can prevent a generic functional word from causing `NON_TARGET_FUNCTIONAL`; strong physical-domain title evidence still wins for construction/civil roles.

- [ ] **Step 4: Run tests GREEN**

```bash
node --test app/lib/profile-delivery-domain.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add app/lib/profile-delivery-domain.js app/lib/profile-delivery-domain.test.mjs
git commit -m "feat: classify profile delivery domains"
```

---

### Task 4: Add semantic interpretation of user-authored exclusion rules

**Files:**
- Create: `app/lib/profile-semantic-exclusions.js`
- Create: `app/lib/profile-semantic-exclusions.test.mjs`

**Interfaces:**
- Consumes: `job`, `rules`, and `domainClassification` from Task 3.
- Produces: `semanticProfileExclusion(job, rules, domainClassification) -> string | null`.

- [ ] **Step 1: Write failing semantic-exclusion tests**

Required cases:

```js
semanticProfileExclusion(sapJob, erpRules, {domain:'EXCLUDED_SPECIALISM',evidence:['erp']})
// => 'Search Profile exclusion: ERP specialist roles'

semanticProfileExclusion(rndJob, rndRules, {domain:'EXCLUDED_SPECIALISM',evidence:['r&d']})
// => 'Search Profile exclusion: R&D roles'

semanticProfileExclusion(sapJob, [], {domain:'EXCLUDED_SPECIALISM',evidence:['erp']})
// => null
```

Also assert unrelated user domain exclusions keep their existing literal deterministic behavior in `linkedin-profile-evaluator.js` and are not broadened here.

- [ ] **Step 2: Run tests RED**

```bash
node --test app/lib/profile-semantic-exclusions.test.mjs
```

- [ ] **Step 3: Implement narrow rule interpretation**

Recognize only explicit rule intents that are safely canonicalized to supported semantic categories, initially:

```text
R&D roles / research and development roles -> R_AND_D
ERP specialist roles / ERP roles / SAP specialist roles -> ERP_SPECIALIST
```

Require an actual user rule with deterministic exclusion semantics before returning an exclusion reason.

- [ ] **Step 4: Run tests GREEN**

```bash
node --test app/lib/profile-semantic-exclusions.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add app/lib/profile-semantic-exclusions.js app/lib/profile-semantic-exclusions.test.mjs
git commit -m "feat: honor semantic profile exclusions"
```

---

### Task 5: Wire the eligibility gate into the existing evaluator without changing score semantics

**Files:**
- Modify: `app/lib/linkedin-profile-evaluator.js`
- Modify/Test: `app/lib/profile-eligibility-gate-regression.test.mjs`
- Existing regression: `app/lib/profile-role-confirmation-regression.test.mjs`

**Interfaces:**
- Consumes: `classifyProfileRoleFamily(job)`, `classifyDeliveryDomain(job)`, `semanticProfileExclusion(job,rules,domainClassification)`.
- Preserves: `evaluateProfileJob(...)` public signature and existing eligible-job `evaluation` shape.

- [ ] **Step 1: Add pure eligibility orchestration before `profileEvaluation()`**

Required order inside `evaluateProfileJob()` after freshness and current literal deterministic exclusions:

```js
const domain = classifyDeliveryDomain(job)
const semanticExclusion = semanticProfileExclusion(job, exclusionRules, domain)
if (semanticExclusion) {
  return {keep:false,evaluated:false,stage:'PROFILE_EXCLUSION_REJECT',decision:'REJECT',reason:semanticExclusion,score:null,evaluation:null}
}

const roleFamily = classifyProfileRoleFamily(job)
if (!TARGET_FAMILIES.has(roleFamily.family)) {
  return {keep:false,evaluated:true,stage:'PROFILE_ROLE_FAMILY_REJECT',decision:'REJECT',reason:'Vacancy professional role family is not project/delivery/implementation/transformation management',score:0,evaluation:null}
}

if (domain.domain==='NON_TARGET_PHYSICAL' || domain.domain==='NON_TARGET_FUNCTIONAL' || domain.domain==='EXCLUDED_SPECIALISM') {
  return {keep:false,evaluated:true,stage:'PROFILE_DOMAIN_REJECT',decision:'REJECT',reason:domainReason(domain),score:0,evaluation:null}
}

if (domain.domain==='AMBIGUOUS') {
  return {keep:false,evaluated:true,stage:'PROFILE_DOMAIN_AMBIGUOUS',decision:'HOLD',reason:'Delivery domain is not sufficiently confirmed from the Full JD',score:null,evaluation:null}
}
```

`TARGET_FAMILIES` initially includes `delivery-management` and `implementation-transformation` only. Do not infer product/architecture/analysis eligibility merely because a current Search Profile direction happens to share a token; if a later product requirement needs those families, that is a separate design change.

- [ ] **Step 2: Preserve the existing `profileEvaluation()` and scoring formula unchanged**

After eligibility passes, call the existing matcher exactly as before. Do not alter:

```js
similarity.score>=0.45 || support>=0.65
base primary 6.5 / adjacent 5.9
score contribution similarity*2.2 + support*.9
```

This task changes who is eligible to reach scoring, not scoring itself.

- [ ] **Step 3: Run BUG #4 regression test GREEN**

```bash
node --test app/lib/profile-eligibility-gate-regression.test.mjs
```

Expected: all protected KEEP cases stay KEEP; false positives have exact reject stages; generic PM is HOLD.

- [ ] **Step 4: Run BUG #3 multilingual regression GREEN**

```bash
node --test app/lib/profile-role-confirmation-regression.test.mjs
```

Expected: baseline + Atea + PET + Regionshospitalet + Energinet continue to pass exactly as protected.

- [ ] **Step 5: Commit evaluator integration**

```bash
git add app/lib/linkedin-profile-evaluator.js app/lib/profile-eligibility-gate-regression.test.mjs
git commit -m "fix: gate profile matches by role and domain"
```

---

### Task 6: Protect Search Run and worthwhile/audit semantics

**Files:**
- Modify only if needed: existing Search Run contract tests; no production Search Run modules should need changes.
- Test: `app/lib/linkedin-profile-jd-batch.test.mjs`
- Test: `app/lib/search-run-store.test.mjs`
- Test: `app/lib/profile-search-run-client.test.mjs`
- Test: `app/lib/union-search-plan.test.mjs`
- Test: `app/lib/union-search-plan-wiring.test.mjs`

**Interfaces:**
- HOLD must not be added to `jobs`/worthwhile results because `keep === false`.
- Audit must retain HOLD with `stage='PROFILE_DOMAIN_AMBIGUOUS'`, `decision='HOLD'`, no relevance score.

- [ ] **Step 1: Add/adjust one batch-level regression only if the existing contracts do not already prove HOLD is excluded from returned jobs**

Use a stub evaluator result with `keep:false, decision:'HOLD'` and assert the processor advances the candidate/checkpoint but does not return it as a worthwhile job.

- [ ] **Step 2: Run Search Run targeted suite**

```bash
node --test app/lib/linkedin-profile-discovery-batch.test.mjs app/lib/linkedin-profile-jd-batch.test.mjs app/lib/search-run-store.test.mjs app/lib/profile-search-run-client.test.mjs app/lib/union-search-plan.test.mjs app/lib/union-search-plan-wiring.test.mjs
```

Expected: all GREEN; no 442/442 transport behavior changes.

- [ ] **Step 3: Commit only if a test contract needed updating**

```bash
git add app/lib/*.test.mjs
git commit -m "test: protect hold audit semantics"
```

If no test changes are necessary, do not create an empty commit.

---

### Task 7: Final verification and repository safety checks

**Files:**
- No production changes expected.

**Interfaces:**
- Verifies all spec success criteria.

- [ ] **Step 1: Run focused eligibility suite**

```bash
node --test app/lib/profile-role-family.test.mjs app/lib/profile-delivery-domain.test.mjs app/lib/profile-semantic-exclusions.test.mjs app/lib/profile-eligibility-gate-regression.test.mjs app/lib/profile-role-confirmation-regression.test.mjs
```

Expected: all GREEN.

- [ ] **Step 2: Run Search Run/Union regressions**

```bash
node --test app/lib/linkedin-profile-discovery-batch.test.mjs app/lib/linkedin-profile-jd-batch.test.mjs app/lib/search-run-store.test.mjs app/lib/profile-search-run-client.test.mjs app/lib/union-search-plan.test.mjs app/lib/union-search-plan-wiring.test.mjs app/lib/profile-driven-live.contract.test.mjs app/lib/profile-shadow-wiring.test.mjs app/lib/search-profile-exclusions-save-ui.test.mjs
```

Expected: all GREEN.

- [ ] **Step 3: Run production build on Node 24**

```bash
npm run build
```

Expected: `next build` succeeds and all existing + Search Run routes compile.

- [ ] **Step 4: Run complete repository test suite**

```bash
npm test
```

Expected: no new failures caused by BUG #4. If the two previously known cosmetic contracts remain stale, report them separately rather than changing unrelated UI behavior.

- [ ] **Step 5: Verify deployment gate and main branch**

Assert:

```text
vercel.json -> feature/cv-library-3-slots deploymentEnabled=false
main HEAD -> remains 354c799c8ffe31e599f175ae4770ae4086a73a91
```

- [ ] **Step 6: Do not deploy**

Deployment requires a separate explicit user authorization after verification.
