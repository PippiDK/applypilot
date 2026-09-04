import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'

const routePath='app/api/night-flight/profile-sync/route.js'
const clientPath='app/lib/night-flight-profile-sync-client.js'
const serverPath='app/lib/night-flight-profile-sync.js'
const pagePath='app/page.js'

test('Task 2 adds an authenticated Night Flight profile sync endpoint',()=>{
  assert.equal(existsSync(routePath),true,'profile sync route must exist')
  if(!existsSync(routePath)) return
  const route=readFileSync(routePath,'utf8')
  assert.match(route,/requireUser\(\)/)
  assert.match(route,/night_flight_profiles/)
  assert.match(route,/onConflict:\s*['"]user_id['"]/)
})

test('Task 2 sync payload contains the saved Search Profile and current primary CV state',()=>{
  assert.equal(existsSync(serverPath),true,'profile sync helper must exist')
  assert.equal(existsSync(clientPath),true,'profile sync client must exist')
  if(!existsSync(serverPath)||!existsSync(clientPath)) return
  const server=readFileSync(serverPath,'utf8')
  const client=readFileSync(clientPath,'utf8')
  assert.match(server,/profile_fingerprint/)
  assert.match(server,/cv_source_version/)
  assert.match(server,/cv_text/)
  assert.match(client,/\/api\/night-flight\/profile-sync/)
})

test('Task 2 syncs after Search Profile save and primary CV changes without replacing local storage',()=>{
  const page=readFileSync(pagePath,'utf8')
  assert.match(page,/syncNightFlightProfile/)
  assert.match(page,/localStorage\.setItem\(['"]applypilot-profile['"],JSON\.stringify\(saved\)\)/)
  assert.match(page,/await syncNightFlightProfile\(\{searchProfile:saved,cv:cvData\}\)/)
  assert.match(page,/syncNightFlightProfile\(\{searchProfile:next,cv:primaryCv\}\)/)
  assert.match(page,/syncNightFlightProfile\(\{searchProfile:next,cv:null\}\)/)
})

test('Task 2 does not silently accept a failed server sync',()=>{
  const client=readFileSync(clientPath,'utf8')
  assert.match(client,/throw new Error\(errorMessage\)/)
  assert.match(client,/console\.error\('\[Night Flight\] profile sync failed'/)
})
