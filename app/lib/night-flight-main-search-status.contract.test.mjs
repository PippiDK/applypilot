import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('Main Search status layer reads the Night Flight index and reuses the Task 2 exact bridge',()=>{
  assert.match(page,/fetch\('\/api\/night-flight-index'/)
  assert.match(page,/enrichSearchJobsWithNightFlight/)
  assert.match(page,/sourceJobId/)
})

test('Main Search renders derived NIGHT FLIGHT only when no manual status overrides it',()=>{
  assert.match(page,/resolveJobStatus/)
  assert.match(page,/NIGHT_FLIGHT_STATUS/)
  assert.match(page,/manualStatus/)
  assert.match(page,/NIGHT FLIGHT/)
})

test('Night Flight index failure is isolated from normal Main Search rendering',()=>{
  assert.match(page,/catch\{\}/)
  assert.match(page,/MainSearchBase\(\)/)
})
