import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('CV Update Review is driven by explicit selected-CV adaptation rather than a standalone JD cache pretest',()=>{
  assert.match(page,/requestTruthGuard/)
  assert.match(page,/runCvAdaptationReview/)
  assert.match(page,/Adapt & review CV/)
  assert.doesNotMatch(page,/readJobAnalysisCache/)
  assert.doesNotMatch(page,/writeJobAnalysisCache/)
})

test('CV Update Review keeps a focused review instead of the obsolete dashboard-style Truth Guard panel',()=>{
  assert.match(page,/CV UPDATE REVIEW/)
  assert.match(page,/Truth Guard complete/)
  assert.match(page,/Only Truth-Guard-safe UPDATED text is shown/)
  assert.doesNotMatch(page,/reviewDashboard/)
  assert.doesNotMatch(page,/truthGuard compact/)
})

test('review cards show Original, Updated, Why changed and independent decisions',()=>{
  assert.match(page,/ORIGINAL/)
  assert.match(page,/UPDATED/)
  assert.match(page,/WHY CHANGED/)
  assert.match(page,/Keep original/)
  assert.match(page,/Accept change/)
  assert.match(page,/change\.updated/)
  assert.match(page,/change\.why/)
})

test('legacy JD evidence accordions are absent because M4.11 reviews safe CV wording, not the JD pretest',()=>{
  assert.doesNotMatch(page,/jdPriority/)
  assert.doesNotMatch(page,/jdMustHave/)
  assert.match(page,/Professional Summary · Latest role overview · Previous role overview/)
})
