# Night Flight Failure Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve safe Night Flight AI failure classifications, defer retries across invocations, bound cron work, and remove duplicate Morning Review errors without changing Expertise Match results.

**Architecture:** Keep the existing durable Supabase queue and shared Expertise Match cache. Add transport classification at the AI boundary, persistence and retry policy at the queue boundary, an explicit three-job invocation budget at the Night Flight processor boundary, and a pure UI message helper used by the Morning Review component. Existing `READY` rows remain terminal and reconciliation continues to derive run state from persisted jobs.

**Tech Stack:** Next.js 14, React 18, Node.js ESM, `node:test`, Supabase JS, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-15-night-flight-failure-hardening.md`

## Global Constraints

- Start from `782be7167f1d5a05d687fbf411e472ec193fefa4` on a dedicated `v18/**` feature branch.
- Do not change Expertise Match scoring weights, semantic rules, prompts, Source CV content, vacancy matching, or saved `READY` analyses.
- Persist only safe AI codes and sanitized user-facing failure text; never persist CV/JD/provider body/API-key content.
- Make no more than one AI attempt per vacancy per queue invocation.
- Retry transient failures only on later invocations; fail known deterministic/non-retryable errors immediately.
- Process at most three Night Flight jobs per processor invocation.
- Develop and verify locally, push once, use GitHub CI, and avoid preview deployment unless runtime-only verification requires it.

---

### Task 1: Establish all new RED contracts

**Files:**
- Modify: `app/lib/ai-client.test.mjs`
- Modify: `app/lib/night-flight-match-queue.test.mjs`
- Modify: `app/lib/night-flight-match-processor.test.mjs`
- Create: `app/lib/night-flight-morning-review-errors.test.mjs`

**Interfaces:**
- Consumes: existing `callStructuredAi`, `processNightFlightQueue`, queue fake Supabase, and processor dependency injection.
- Produces: behavioral contracts for `AI_PROVIDER_TIMEOUT`, `AI_PROVIDER_NETWORK`, safe persisted error text, deferred retries, terminal deterministic errors, the three-job default budget, `READY` preservation, resume/reconciliation, and deduplicated UI messages.

- [ ] **Step 1: Add AI transport classification tests**

```js
test('callStructuredAi classifies provider timeouts safely', async () => {
  const timeout = new Error('PRIVATE PROVIDER TIMEOUT DETAIL')
  timeout.name = 'TimeoutError'
  await assert.rejects(
    () => callStructuredAi({stage:'expertise_match_one_pass', instructions:'Analyze.', input:{jd:'PRIVATE JD'}, schema, modelCall:async()=>{throw timeout}}),
    error => error.code === 'AI_PROVIDER_TIMEOUT' && !error.message.includes('PRIVATE')
  )
})

test('callStructuredAi classifies provider network failures safely', async () => {
  await assert.rejects(
    () => callStructuredAi({stage:'expertise_match_one_pass', instructions:'Analyze.', input:{jd:'PRIVATE JD'}, schema, modelCall:async()=>{throw new TypeError('PRIVATE NETWORK DETAIL')}}),
    error => error.code === 'AI_PROVIDER_NETWORK' && !error.message.includes('PRIVATE')
  )
})
```

- [ ] **Step 2: Replace the immediate-retry queue expectation and add persistence/policy/budget tests**

```js
test('Night Flight persists safe AI classification without provider or source details', async () => {
  const mod=await loadModule()
  const supabase=fakeSupabase({jobs:[job('rate-limited','QUEUED')],runs:[run()]})
  const error = new Error('expertise_match_one_pass AI stage failed.')
  error.code = 'AI_PROVIDER_HTTP_429'
  await mod.processNightFlightQueue({
    supabase,runId:'run-6',maxJobs:1,
    now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async()=>{throw error},
  })
  const saved=supabase.state.jobs[0]
  assert.equal(saved.status, 'RETRY')
  assert.equal(saved.last_error, 'AI_PROVIDER_HTTP_429 · expertise_match_one_pass AI stage failed.')
})

test('Night Flight does not reclaim the same RETRY job in one invocation', async () => {
  const mod=await loadModule()
  const supabase=fakeSupabase({jobs:[job('bad','QUEUED'),job('good','QUEUED')],runs:[run()]})
  const calls=[]
  const result=await mod.processNightFlightQueue({
    supabase,runId:'run-6',maxJobs:10,
    now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>{
      calls.push(claimed.job_key)
      if(claimed.job_key==='bad') throw new Error('temporary failure')
      return {matchCacheKey:'cache:good'}
    },
  })
  const bad=supabase.state.jobs.find(row=>row.job_key==='bad')
  assert.deepEqual(calls, ['bad', 'good'])
  assert.equal(bad.status, 'RETRY')
  assert.equal(result.status, 'RUNNING')
})

test('Night Flight makes a retryable job available on a later invocation', async () => {
  const mod=await loadModule()
  const supabase=fakeSupabase({jobs:[job('bad','QUEUED')],runs:[run()]})
  const calls=[]
  await mod.processNightFlightQueue({
    supabase,runId:'run-6',maxJobs:10,
    now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>{calls.push(claimed.job_key);throw new Error('temporary failure')},
  })
  const result=await mod.processNightFlightQueue({
    supabase,runId:'run-6',maxJobs:10,
    now:()=>new Date('2026-09-05T03:00:00.000Z'),
    processJob:async claimed=>{calls.push(claimed.job_key);return {matchCacheKey:'cache:bad'}},
  })
  const bad=supabase.state.jobs[0]
  assert.deepEqual(calls, ['bad', 'bad'])
  assert.equal(bad.status, 'READY')
  assert.equal(result.status, 'READY')
})

test('Night Flight fails deterministic AI validation without consuming retry budget', async () => {
  const mod=await loadModule()
  const supabase=fakeSupabase({jobs:[job('invalid','QUEUED')],runs:[run()]})
  const error = new Error('PRIVATE-JD-ID')
  error.code = 'AI_EXPERTISE_VALIDATION'
  const result=await mod.processNightFlightQueue({
    supabase,runId:'run-6',maxJobs:10,
    now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async()=>{throw error},
  })
  const failed=supabase.state.jobs[0]
  assert.equal(failed.status,'FAILED')
  assert.equal(failed.attempts,1)
  assert.match(failed.last_error,/^AI_EXPERTISE_VALIDATION ·/)
  assert.doesNotMatch(failed.last_error,/PRIVATE-JD-ID/)
  assert.equal(result.status,'READY_WITH_ERRORS')
})

test('Night Flight default invocation budget processes only three jobs and leaves READY untouched', async () => {
  const mod=await loadModule()
  const supabase=fakeSupabase({jobs:[
    job('ready','READY'),job('one','QUEUED'),job('two','QUEUED'),job('three','QUEUED'),job('four','QUEUED'),
  ],runs:[run()]})
  const calls=[]
  const result=await mod.processNightFlightQueue({
    supabase,runId:'run-6',now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>{calls.push(claimed.job_key);return {matchCacheKey:`cache:${claimed.job_key}`}},
  })
  const existingReady=supabase.state.jobs.find(row=>row.job_key==='ready')
  const fourth=supabase.state.jobs.find(row=>row.job_key==='four')
  assert.deepEqual(calls, ['one', 'two', 'three'])
  assert.equal(existingReady.attempts, 0)
  assert.equal(fourth.status, 'QUEUED')
  assert.equal(result.status, 'RUNNING')
})
```

- [ ] **Step 3: Add processor-boundary budget test**

```js
assert.equal(queueInput.maxJobs, 3)
```

- [ ] **Step 4: Add pure Morning Review error-list tests**

```js
test('Morning Review renders identical saved and recovery failures once', async () => {
  const {nightFlightFailureMessages} = await loadModule()
  assert.deepEqual(nightFlightFailureMessages('same failure', 'same failure'), ['same failure'])
})

test('Morning Review keeps distinct saved and recovery failures visible', async () => {
  const {nightFlightFailureMessages} = await loadModule()
  assert.deepEqual(nightFlightFailureMessages('saved failure', 'new failure'), ['saved failure', 'new failure'])
})
```

- [ ] **Step 5: Run the complete targeted RED set before editing production files**

Run:

```bash
node --test \
  app/lib/ai-client.test.mjs \
  app/lib/night-flight-match-queue.test.mjs \
  app/lib/night-flight-match-processor.test.mjs \
  app/lib/night-flight-morning-review-errors.test.mjs
```

Expected: existing tests remain green while every new behavior fails for the intended missing behavior: absent transport codes, absent persisted code prefix, same-invocation retry, no default three-job processor budget, deterministic error left in `RETRY`, and missing UI helper.

### Task 2: Implement safe AI and durable queue failure policy

**Files:**
- Modify: `app/lib/ai-client.js`
- Modify: `app/lib/night-flight-match-queue.js`

**Interfaces:**
- Consumes: provider errors and the existing safe `AI_*` codes.
- Produces: sanitized `error.code`, safe persisted `last_error`, one-attempt-per-key invocation behavior, and direct terminal state for known non-retryable AI failures.

- [ ] **Step 1: Classify transport failures at the structured AI boundary**

```js
function safeAiFailureCode(error){
  const code=String(error?.code||'').trim()
  if(/^AI_[A-Z0-9_]+$/.test(code)) return code
  const name=String(error?.name||'')
  if(name==='AbortError'||name==='TimeoutError'||/TIMEOUT/.test(code)) return 'AI_PROVIDER_TIMEOUT'
  if(error instanceof TypeError) return 'AI_PROVIDER_NETWORK'
  return ''
}
```

Use that helper in `callStructuredAi()` while keeping the existing sanitized `<stage> AI stage failed.` message.

- [ ] **Step 2: Persist only a whitelisted safe AI code/message combination**

```js
function safeErrorMessage(error){
  const code=safeAiCode(error)
  const raw=clean(error?.message||error||'')
  const safeStage=/^[a-zA-Z0-9_-]{1,64} AI stage failed\.$/.test(raw)
  const message=safeStage?raw:(code?'Night Flight Match failed safely.':(raw||'Night Flight Match failed'))
  return (code?`${code} · ${message}`:message).slice(0,500)
}
```

Here `safeAiCode(error)` accepts only values matching `/^AI_[A-Z0-9_]+$/`; all other values return an empty string.

Known coded validation failures must use the generic safe message so model-generated IDs or source fragments cannot be persisted.

- [ ] **Step 3: Distinguish retryable from terminal AI failures**

```js
function isRetryableFailure(error){
  const code=safeAiCode(error)
  if(!code) return true
  if(code==='AI_PROVIDER_NETWORK'||code==='AI_PROVIDER_TIMEOUT') return true
  const status=Number(code.match(/^AI_PROVIDER_HTTP_(\d{3})$/)?.[1])
  if(status) return status===408||status===409||status===425||status===429||status>=500
  return false
}
```

Set `FAILED` immediately when `isRetryableFailure(error)` is false; otherwise retain the current three-attempt budget.

- [ ] **Step 4: Prevent reclaims of keys already attempted by the current process call**

```js
const attemptedJobKeys=new Set()
const claimed=await claimNextNightFlightJob({
  supabase,
  runId:id,
  now,
  leaseMs:lease,
  maxAttempts:attemptsLimit,
  excludedJobKeys:attemptedJobKeys,
})
if(!claimed) break
attemptedJobKeys.add(clean(claimed.job_key))
```

Filter `excludedJobKeys` in `claimNextNightFlightJob()` after loading durable candidates and before attempting CAS updates.

- [ ] **Step 5: Run queue and AI tests until GREEN**

Run:

```bash
node --test app/lib/ai-client.test.mjs app/lib/night-flight-match-queue.test.mjs
```

Expected: all AI-client and queue tests pass with zero failed tests.

### Task 3: Bound processor work and deduplicate Morning Review errors

**Files:**
- Modify: `app/lib/night-flight-match-queue.js`
- Modify: `app/lib/night-flight-match-processor.js`
- Create: `app/lib/night-flight-morning-review-errors.js`
- Modify: `app/components/night-flight-morning-review.js`

**Interfaces:**
- Consumes: queue `maxJobs`, selected job `lastError`, and current `recoveryError`.
- Produces: `DEFAULT_NIGHT_FLIGHT_MAX_JOBS_PER_INVOCATION = 3` and `nightFlightFailureMessages(lastError, recoveryError): string[]`.

- [ ] **Step 1: Add and pass the explicit invocation budget**

```js
export const DEFAULT_NIGHT_FLIGHT_MAX_JOBS_PER_INVOCATION=3
```

Default `processNightFlightQueue.maxJobs` and `processNightFlightRunMatches.maxJobs` to that constant, then pass `maxJobs` explicitly from the processor to the injected queue.

- [ ] **Step 2: Implement a pure stable-order error deduplicator**

```js
const clean=value=>String(value??'').trim()

export function nightFlightFailureMessages(lastError,recoveryError){
  return [...new Set([clean(lastError),clean(recoveryError)].filter(Boolean))]
}
```

- [ ] **Step 3: Render the helper output once per unique message**

```jsx
const failureMessages=nightFlightFailureMessages(selected?.lastError,recoveryError)

{selected?.status==='FAILED'&&<>
  {failureMessages.map(message=><div key={message} className={styles.failure}>{message}</div>)}
  <button type="button" className={styles.retry} onClick={recoverNightFlightMatch} disabled={recoveringKey===selected.key}>{recoveringKey===selected.key?'Running…':'Run Match'}</button>
</>}
```

- [ ] **Step 4: Run the complete targeted set until GREEN**

Run:

```bash
node --test \
  app/lib/ai-client.test.mjs \
  app/lib/night-flight-match-queue.test.mjs \
  app/lib/night-flight-match-processor.test.mjs \
  app/lib/night-flight-morning-review-errors.test.mjs \
  app/lib/night-flight-scheduler.test.mjs \
  app/lib/night-flight-v18-regression-guard.test.mjs
```

Expected: all targeted tests pass, including the existing `READY`, resume, scheduler, cache-reuse, and reconciliation guards.

### Task 4: Full verification, one coherent push, and release gate

**Files:**
- No production changes unless verification exposes a defect directly caused by Tasks 2–3.

**Interfaces:**
- Consumes: the complete feature branch.
- Produces: local GREEN evidence, one feature commit/SHA, GitHub CI evidence, final merged SHA, one production deployment, and post-tick runtime evidence.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: every test passes with zero failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Next.js build exits `0` and completes route generation.

- [ ] **Step 3: Inspect scope and generated files**

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff -- app/lib/ai-client.js app/lib/night-flight-match-queue.js app/lib/night-flight-match-processor.js app/components/night-flight-morning-review.js
```

Expected: only the spec/plan, focused implementation files, and their tests differ; no scoring, prompt, CV, search, cache identity, or unrelated UI files changed.

- [ ] **Step 4: Commit and push once**

```bash
git add \
  docs/superpowers/specs/2026-09-15-night-flight-failure-hardening.md \
  docs/superpowers/plans/2026-09-15-night-flight-failure-hardening.md \
  app/lib/ai-client.js \
  app/lib/ai-client.test.mjs \
  app/lib/night-flight-match-queue.js \
  app/lib/night-flight-match-queue.test.mjs \
  app/lib/night-flight-match-processor.js \
  app/lib/night-flight-match-processor.test.mjs \
  app/lib/night-flight-morning-review-errors.js \
  app/lib/night-flight-morning-review-errors.test.mjs \
  app/components/night-flight-morning-review.js
git commit -m "fix: harden Night Flight failure processing"
git push -u origin v18/night-flight-failure-hardening
```

- [ ] **Step 5: Use GitHub Actions as the remote gate**

Verify the `V18 TEST verification` workflow for the pushed SHA completes with both `npm test` and `npm run build` green. Do not deploy a preview merely to repeat those checks.

- [ ] **Step 6: Merge once CI is green and verify the production deployment**

Merge the verified feature SHA into `main`, confirm the resulting Vercel production deployment is `READY`, and confirm the visible production badge contains the merged commit short SHA. Do not create iterative preview deployments.

- [ ] **Step 7: Verify runtime behavior after the next Night Flight tick**

Confirm the cron invocation completes below 300 seconds; no vacancy is attempted twice within one invocation; retryable failures retain a safe classified `RETRY`; terminal failures retain a safe classified `FAILED`; existing `READY` cache references and percentages are unchanged; and the Morning Review displays identical saved/recovery errors once.
