import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const bestCvPanel=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')

test('M4 review runs direct selected-CV adaptation before opening review',()=>{
  assert.match(page,/requestCvAdaptation/)
  assert.match(page,/buildAdaptationBaseline/)
  assert.match(page,/baselineMatches/)
  assert.match(page,/adaptationReviewBlocks/)
  assert.match(page,/Adapt & review CV/)
})

test('review decisions use exact baseline identity and original or accepted values',()=>{
  assert.match(page,/setAdaptationDecision/)
  assert.match(page,/readAdaptationDecision/)
  assert.match(page,/sourceVersion/)
  assert.match(page,/ADAPTATION_DECISION\.ORIGINAL/)
  assert.match(page,/ADAPTATION_DECISION\.ACCEPTED/)
})

test('switching vacancy or selected CV cannot expose a stale adaptation result',()=>{
  assert.match(page,/baselineMatches\(\{baseline:storedAdaptationBaseline,job:active\?\.job,cv:selectedAdaptationCvRecord\}\)/)
  assert.match(page,/adaptationRun\.jobKey===jobKey&&adaptationRun\.baselineKey===activeBaselineKey/)
})

test('Accept and Keep handlers mutate decision state only, not CV Library or Source CV',()=>{
  const start=page.indexOf('  function setDecision(blockId,value){')
  const end=page.indexOf('\n\n  return <main>',start)
  assert.ok(start>=0&&end>start)
  const handlers=page.slice(start,end)
  assert.match(handlers,/setDecisions/)
  assert.doesNotMatch(handlers,/setCvData/)
  assert.doesNotMatch(handlers,/setCvLibrary/)
  assert.doesNotMatch(handlers,/upsertCvSlot/)
})

test('review UI renders the three-block contract and WHY CHANGED from direct AI review blocks',()=>{
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
