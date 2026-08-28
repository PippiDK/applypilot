import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const bestCvPanel=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')

test('M4.11 page runs the real selected-CV Truth Guard pipeline before opening review',()=>{
  assert.match(page,/requestTruthGuard/)
  assert.match(page,/buildAdaptationBaseline/)
  assert.match(page,/baselineMatches/)
  assert.match(page,/safeAdaptationReviewBlocks/)
  assert.match(page,/Adapt & review CV/)
})

test('review decisions use exact baseline identity and original or accepted values',()=>{
  assert.match(page,/setAdaptationDecision/)
  assert.match(page,/readAdaptationDecision/)
  assert.match(page,/sourceVersion/)
  assert.match(page,/ADAPTATION_DECISION\.ORIGINAL/)
  assert.match(page,/ADAPTATION_DECISION\.ACCEPTED/)
})

test('review UI renders the three-block contract and WHY CHANGED from safe review blocks',()=>{
  assert.match(page,/Professional Summary/)
  assert.match(page,/Latest role overview/)
  assert.match(page,/Previous role overview/)
  assert.match(page,/WHY CHANGED/)
  assert.match(page,/change\.updated/)
  assert.match(page,/change\.why/)
  assert.doesNotMatch(page,/buildReviewChanges\(cvData,active\)/)
})

test('BestCvPanel no longer owns adaptation selection state',()=>{
  assert.match(bestCvPanel,/selectedCvId/)
  assert.match(bestCvPanel,/onSelectCv/)
  assert.doesNotMatch(bestCvPanel,/setAdaptationBaselines/)
  assert.doesNotMatch(bestCvPanel,/buildAdaptationBaseline/)
})
