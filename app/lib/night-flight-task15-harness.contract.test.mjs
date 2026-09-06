import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const routeUrl=new URL('../api/test/night-flight-task15/route.js',import.meta.url)

async function routeSource(){
  return readFile(routeUrl,'utf8')
}

test('Task 15 harness is Preview-only and branch-scoped',async()=>{
  const source=await routeSource()
  assert.match(source,/VERCEL_ENV\s*===\s*['"]preview['"]/)
  assert.match(source,/v18\/night-flight-task15-overnight-test/)
})

test('Task 15 overnight run uses real wall-clock time and the production scheduler',async()=>{
  const source=await routeSource()
  assert.match(source,/runNightFlightScheduler/)
  assert.match(source,/new Date\(\)/)
  assert.doesNotMatch(source,/FORCED_NOW|forcedNow|2026-09-0[1-9]T\d\d:/)
  assert.match(source,/Europe\/Copenhagen/)
})

test('Task 15 harness supports separate run and read-only morning verification actions',async()=>{
  const source=await routeSource()
  assert.match(source,/['"]run['"]/)
  assert.match(source,/['"]verify['"]/)
  assert.match(source,/matchAlreadyLoaded/)
  assert.match(source,/expertise_match_cache/)
})
