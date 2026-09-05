import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const componentPath=new URL('../components/night-flight-morning-review.js',import.meta.url)
const pagePath=new URL('../page.js',import.meta.url)
const component=fs.existsSync(componentPath)?fs.readFileSync(componentPath,'utf8'):''
const page=fs.readFileSync(pagePath,'utf8')

test('Task 9 mounts Morning Review as an isolated component without replacing Manual Search',()=>{
  assert.match(page,/import NightFlightMorningReview from '\.\/components\/night-flight-morning-review\.js'/)
  assert.match(page,/<NightFlightMorningReview\s*\/>/)
  assert.match(page,/async function search\(\)/,'Manual Search flow must remain present')
})

test('Task 9 Morning Review card and panel follow the approved saved-batch UX',()=>{
  assert.match(component,/NIGHT FLIGHT/)
  assert.match(component,/Last completed day/)
  assert.match(component,/READY/)
  assert.match(component,/FAILED/)
  assert.match(component,/Open Night Flight/)
  assert.match(component,/Profile Match/)
  assert.match(component,/Run Match/)
})

test('Task 9 loads saved review once and does not implement Task 10 polling or duplicate Match calls',()=>{
  assert.match(component,/\/api\/night-flight-review/)
  assert.doesNotMatch(component,/setInterval|setTimeout/)
  assert.doesNotMatch(component,/requestExpertiseMatch|analyzeExpertiseMatch|getOrCreateExpertiseMatch/)
})

test('Task 9 FAILED recovery entry is visible but actual manual recovery remains deferred to Task 11',()=>{
  assert.match(component,/disabled[^>]*>Run Match<\/button>|>Run Match<\/button>/)
  assert.doesNotMatch(component,/fetch\([^)]*expertise-match/)
})
