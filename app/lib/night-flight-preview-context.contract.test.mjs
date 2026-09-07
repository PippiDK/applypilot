import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const helperPath=new URL('./night-flight-preview-context.js',import.meta.url)
const settingsPath=new URL('../api/night-flight-settings/route.js',import.meta.url)
const reviewPath=new URL('../api/night-flight-review/route.js',import.meta.url)
const statusPath=new URL('../api/night-flight-status/route.js',import.meta.url)

const helper=fs.existsSync(helperPath)?fs.readFileSync(helperPath,'utf8'):''
const settings=fs.readFileSync(settingsPath,'utf8')
const review=fs.readFileSync(reviewPath,'utf8')
const status=fs.readFileSync(statusPath,'utf8')

test('Night Flight Preview resolves against the isolated TEST Supabase context only',()=>{
  assert.match(helper,/process\.env\.VERCEL_ENV\s*===\s*['"]preview['"]/)
  assert.match(helper,/https:\/\/tafdswfdblxoehreaalm\.supabase\.co/)
  assert.match(helper,/14141414-1414-4141-8141-141414141414/)
  assert.match(helper,/noStoreFetch/)
  assert.doesNotMatch(helper,/NODE_ENV/)
  assert.match(helper,/requireUser\(\)/)
  assert.match(helper,/createServerSupabaseClient\(\)/)
})

test('all ordinary Night Flight UI routes use the same request context resolver',()=>{
  for(const route of [settings,review,status]){
    assert.match(route,/resolveNightFlightRequestContext/)
    assert.doesNotMatch(route,/const user=await requireUser\(\)/)
    assert.doesNotMatch(route,/const supabase=await createServerSupabaseClient\(\)/)
  }
})
