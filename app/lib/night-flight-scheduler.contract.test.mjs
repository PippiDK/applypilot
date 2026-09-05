import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=async path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8').catch(()=> '')

test('Task 7 config schedules both UTC candidates for Copenhagen 02:00 on the same cron endpoint',async()=>{
  const config=JSON.parse(await read('vercel.json'))
  const nightFlight=(config.crons||[]).filter(entry=>entry.path==='/api/cron/night-flight')
  assert.deepEqual(nightFlight.map(entry=>entry.schedule).sort(),['0 0 * * *','0 1 * * *'])
})

test('Task 7 cron endpoint is server-secret protected and delegates to the backend scheduler',async()=>{
  const source=await read('app/api/cron/night-flight/route.js')
  assert.match(source,/CRON_SECRET/)
  assert.match(source,/authorization/i)
  assert.match(source,/createAdminSupabaseClient/)
  assert.match(source,/runNightFlightScheduler/)
  assert.doesNotMatch(source,/requireUser/)
})

test('Task 7 admin Supabase client uses the server-only service role key',async()=>{
  const source=await read('app/lib/supabase/admin.js')
  assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(source,/createClient/)
  assert.match(source,/persistSession\s*:\s*false/)
})

test('Task 7 scheduler owns Copenhagen local-time gating and enabled-user dispatch',async()=>{
  const source=await read('app/lib/night-flight-scheduler.js')
  assert.match(source,/Europe\/Copenhagen/)
  assert.match(source,/night_flight_settings/)
  assert.match(source,/enabled/)
  assert.match(source,/runUser/)
})

test('Task 7 per-user runner composes existing Task 4 discovery and Task 5 persistence only',async()=>{
  const source=await read('app/lib/night-flight-runner.js')
  assert.match(source,/runNightFlightLastCompletedDayDiscovery/)
  assert.match(source,/persistNightFlightAreaScope/)
  assert.doesNotMatch(source,/expertise-match|runNightFlightMatchQueue|match_cache/i)
})
