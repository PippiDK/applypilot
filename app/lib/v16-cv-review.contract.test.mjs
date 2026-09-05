import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('CV Update Review is driven by explicit selected-CV adaptation rather than a standalone JD cache pretest',()=>{
  assert.match(page,/requestCvAdaptation/)
  assert.match(page,/runCvAdaptationReview/)
  assert.match(page,/Generate CV update/)
  assert.match(page,/View CV update/)
  assert.doesNotMatch(page,/readJobAnalysisCache/)
  assert.doesNotMatch(page,/writeJobAnalysisCache/)
})

test('CV Update Review keeps a focused ORIGINAL UPDATED review without the obsolete Truth Guard panel',()=>{
  assert.match(page,/CV UPDATE REVIEW/)
  assert.match(page,/Adaptation complete/)
  assert.match(page,/AI UPDATED text is shown directly/)
  assert.doesNotMatch(page,/reviewDashboard/)
  assert.doesNotMatch(page,/truthGuard compact/)
})

test('review cards show Original, editable Updated, Why changed and independent decisions',()=>{
  assert.match(page,/ORIGINAL/)
  assert.match(page,/UPDATED · EDITABLE/)
  assert.match(page,/WHY CHANGED/)
  assert.match(page,/Keep original/)
  assert.match(page,/Accept change/)
  assert.match(page,/editedUpdateFor\(change\)/)
  assert.match(page,/updatedTextEditor/)
  assert.match(page,/change\.why/)
})

test('legacy JD evidence accordions are absent because M4 reviews the three adapted CV blocks, not the JD pretest',()=>{
  assert.doesNotMatch(page,/jdPriority/)
  assert.doesNotMatch(page,/jdMustHave/)
  assert.match(page,/Professional Summary · Latest role overview · Previous role overview/)
})
