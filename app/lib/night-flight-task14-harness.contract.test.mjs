import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/test/night-flight-task14/route.js',import.meta.url)
const route=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Task 14 harness is restricted to the exact Preview acceptance branch',()=>{
  assert.match(route,/process\.env\.VERCEL_ENV\s*===\s*['"]preview['"]/)
  assert.match(route,/process\.env\.VERCEL_GIT_COMMIT_REF\s*===\s*['"]v18\/night-flight-task14-test-forced-day['"]/)
  assert.match(route,/TASK14_ACCEPTANCE/)
})

test('Task 14 harness uses only the isolated TEST Supabase project',()=>{
  assert.match(route,/https:\/\/tafdswfdblxoehreaalm\.supabase\.co/)
  assert.doesNotMatch(route,/gqexqkmoqmdcjvxzjxlk/)
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/)
})

test('Task 14 harness exposes only the four explicit acceptance phases',()=>{
  for(const action of ['crash','resume-fail','recover','repeat']){
    assert.match(route,new RegExp(`['"]${action}['"]`))
  }
  assert.match(route,/runNightFlightLastCompletedDayDiscovery/)
  assert.match(route,/recoverFailedNightFlightMatch/)
  assert.match(route,/resolveManualExpertiseMatch/)
})
