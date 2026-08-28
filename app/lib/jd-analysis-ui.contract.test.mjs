import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('Adapt & review CV runs the selected-CV Truth Guard pipeline only on explicit user action',()=>{
  assert.match(source,/requestTruthGuard/)
  assert.match(source,/async function runCvAdaptationReview/)
  assert.match(source,/onClick=\{runCvAdaptationReview\}/)
  assert.doesNotMatch(source,/useEffect\([^)]*requestTruthGuard/s)
})

test('obsolete JD ANALYSIS PRETEST dashboard is removed from M4.11 review',()=>{
  assert.doesNotMatch(source,/JD ANALYSIS PRETEST/)
  assert.doesNotMatch(source,/Role mission/)
  assert.doesNotMatch(source,/Hiring priorities/)
  assert.doesNotMatch(source,/Must-haves/)
  assert.doesNotMatch(source,/Candidate positioning/)
  assert.match(source,/Truth Guard complete/)
})

test('M4.11 review exposes all three approved CV blocks instead of Summary-only pretest UI',()=>{
  assert.match(source,/Professional Summary/)
  assert.match(source,/Latest role overview/)
  assert.match(source,/Previous role overview/)
  assert.match(source,/safeAdaptationReviewBlocks/)
})

test('JD qualification detail stays inside the adaptation pipeline instead of being duplicated in review UI',()=>{
  assert.doesNotMatch(source,/analysis\.mustHaves/)
  assert.match(source,/JD analysis → selected-CV evidence → three writers → Truth Guard/)
})
