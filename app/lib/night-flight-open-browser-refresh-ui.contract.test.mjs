import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const componentPath=new URL('../components/night-flight-morning-review.js',import.meta.url)
const source=fs.existsSync(componentPath)?fs.readFileSync(componentPath,'utf8'):''

test('Task 10 polls lightweight Night Flight status every 45 seconds only for active runs',()=>{
  assert.match(source,/\/api\/night-flight-status/)
  assert.match(source,/45000/)
  assert.match(source,/PENDING/)
  assert.match(source,/RUNNING/)
  assert.match(source,/setTimeout/)
})

test('Task 10 stops polling at terminal state and performs one full saved-review refresh',()=>{
  assert.match(source,/READY_WITH_ERRORS/)
  assert.match(source,/NO_JOBS/)
  assert.match(source,/FAILED/)
  assert.match(source,/clearTimeout/)
  assert.match(source,/\/api\/night-flight-review/)
})

test('Task 10 polling remains browser-display-only and does not initiate Night Flight or Match work',()=>{
  assert.doesNotMatch(source,/\/api\/cron\/night-flight/)
  assert.doesNotMatch(source,/analyzeExpertiseMatch|requestExpertiseMatch|getOrCreateExpertiseMatch/)
})
