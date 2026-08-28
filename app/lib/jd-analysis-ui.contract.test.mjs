import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('Adapt & review CV runs direct selected-CV adaptation only on explicit user action',()=>{
  assert.match(source,/requestCvAdaptation/)
  assert.match(source,/async function runCvAdaptationReview/)
  assert.match(source,/onClick=\{runCvAdaptationReview\}/)
  assert.doesNotMatch(source,/useEffect\([^)]*requestCvAdaptation/s)
})

test('obsolete JD ANALYSIS PRETEST dashboard is removed from M4.11 review',()=>{
  assert.doesNotMatch(source,/JD ANALYSIS PRETEST/)
  assert.doesNotMatch(source,/Role mission/)
  assert.doesNotMatch(source,/Hiring priorities/)
  assert.doesNotMatch(source,/Must-haves/)
  assert.doesNotMatch(source,/Candidate positioning/)
  assert.match(source,/Adaptation complete/)
})

test('M4 review exposes all three AI-updated CV blocks instead of Summary-only pretest UI',()=>{
  assert.match(source,/Professional Summary/)
  assert.match(source,/Latest role overview/)
  assert.match(source,/Previous role overview/)
  assert.match(source,/adaptationReviewBlocks/)
})

test('JD is sent with the selected CV and qualification detail is not duplicated in review UI',()=>{
  assert.doesNotMatch(source,/analysis\.mustHaves/)
  assert.match(source,/Selected CV \+ JD → three AI updates\./)
})
