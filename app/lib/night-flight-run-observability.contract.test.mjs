import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migrationUrl=new URL('../../supabase/migrations/20260908_night_flight_execution_log.sql',import.meta.url)
const routeUrl=new URL('../api/cron/night-flight/route.js',import.meta.url)

test('Night Flight persists every scheduler attempt as STARTED then SUCCEEDED or FAILED',async()=>{
  let migration=''
  try{migration=await readFile(migrationUrl,'utf8')}catch{}
  assert.match(migration,/create\s+table\s+if\s+not\s+exists\s+public\.night_flight_executions/i)
  assert.match(migration,/status\s+text/i)
  assert.match(migration,/STARTED/i)
  assert.match(migration,/SUCCEEDED/i)
  assert.match(migration,/FAILED/i)
  assert.match(migration,/result\s+jsonb/i)
  assert.match(migration,/error\s+text/i)
})

test('Night Flight cron route records durable execution telemetry and keeps CRON_SECRET protection',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/CRON_SECRET/)
  assert.match(source,/night_flight_executions/)
  assert.match(source,/STARTED/)
  assert.match(source,/SUCCEEDED/)
  assert.match(source,/FAILED/)
  assert.match(source,/usersFailed/)
})

test('Night Flight cron route supports temporary hashed diagnostic trigger without storing its plaintext token',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/createHash\(['"]sha256['"]\)/)
  assert.match(source,/diagnostic/i)
  assert.match(source,/44ada9ba83677d21d3e91cc4ea5cc50c6d207ffc6264c3008d53a26d22a24ab6/)
  assert.doesNotMatch(source,/QdeLUMf0smv8xHTOIj-sKu1aHq3i5cyrlO_3sXWTDvw/)
})

test('Preview Night Flight cron pins admin access to TEST Supabase before diagnostic execution',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/VERCEL_ENV\s*===\s*['"]preview['"]/) 
  assert.match(source,/https:\/\/tafdswfdblxoehreaalm\.supabase\.co/)
  assert.match(source,/NEXT_PUBLIC_SUPABASE_URL\s*:\s*TEST_SUPABASE_URL/)
})
