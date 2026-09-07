import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const componentPath=new URL('../components/night-flight-morning-review.js',import.meta.url)
const pagePath=new URL('../page.js',import.meta.url)
const layoutPath=new URL('../layout.js',import.meta.url)
const component=fs.existsSync(componentPath)?fs.readFileSync(componentPath,'utf8'):''
const page=fs.readFileSync(pagePath,'utf8')
const layout=fs.readFileSync(layoutPath,'utf8')

test('Task 11 keeps Morning Review isolated without replacing Manual Search',()=>{
  assert.match(layout,/import NightFlightMorningReview from '\.\/components\/night-flight-morning-review\.js'/)
  assert.match(layout,/<NightFlightMorningReview\s*\/>/)
  assert.match(page,/async function search\(\)/,'Manual Search flow must remain present')
})

test('Task 11 Morning Review card and panel preserve saved-batch UX',()=>{
  assert.match(component,/NIGHT FLIGHT/)
  assert.match(component,/Last completed day/)
  assert.match(component,/READY/)
  assert.match(component,/FAILED/)
  assert.match(component,/Open Night Flight/)
  assert.match(component,/Profile Match/)
  assert.match(component,/Run Match/)
})

test('Task 11 review still loads saved Match data and does not create a second client-side scoring path',()=>{
  assert.match(component,/\/api\/night-flight-review/)
  assert.doesNotMatch(component,/requestExpertiseMatch|analyzeExpertiseMatch|getOrCreateExpertiseMatch/)
})

test('Task 11 FAILED Run Match invokes authenticated review recovery and replaces the review with refreshed saved data',()=>{
  assert.match(component,/async function recoverNightFlightMatch/)
  assert.match(component,/fetch\('\/api\/night-flight-review'/)
  assert.match(component,/method:'POST'/)
  assert.match(component,/JSON\.stringify\(\{runId:review\.run\.id,jobKey:selected\.key\}\)/)
  assert.match(component,/setReview\(next\)/)
  assert.match(component,/setSelectedKey\(selected\.key\)/)
  assert.doesNotMatch(component,/className=\{styles\.retry\}\s+disabled>Run Match<\/button>/)
})
