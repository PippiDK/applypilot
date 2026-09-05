import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const serverSyncPath = new URL('./night-flight-profile-sync.js', import.meta.url)
const clientSyncPath = new URL('./night-flight-profile-client.js', import.meta.url)
const routePath = new URL('../api/night-flight-profile/route.js', import.meta.url)
const pagePath = new URL('../page.js', import.meta.url)

test('Task 2D builds and persists one coherent state from the saved Search Profile and primary CV', async () => {
  assert.equal(existsSync(serverSyncPath), true, 'Task 2D server sync helper must exist')
  if (!existsSync(serverSyncPath)) return

  const { syncNightFlightProfileSave } = await import(serverSyncPath)
  const calls = []
  const supabase = {
    from(table) {
      calls.push(['from', table])
      return {
        upsert(payload, options) {
          calls.push(['upsert', payload, options])
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  const result = await syncNightFlightProfileSave({
    supabase,
    userId: 'user-7',
    searchProfile: { roles: 'Senior Project Manager', savedAt: '2026-09-05T18:30:00.000Z' },
    cv: { text: 'Primary CV text', sourceVersion: 'cv-7' },
    now: '2026-09-05T18:31:00.000Z',
  })

  assert.equal(calls[0][1], 'night_flight_profiles')
  assert.equal(calls[1][1].user_id, 'user-7')
  assert.deepEqual(calls[1][1].search_profile, { roles: 'Senior Project Manager', savedAt: '2026-09-05T18:30:00.000Z' })
  assert.equal(calls[1][1].cv_text, 'Primary CV text')
  assert.equal(calls[1][1].cv_source_version, 'cv-7')
  assert.match(calls[1][1].profile_fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(calls[1][1].synced_at, '2026-09-05T18:31:00.000Z')
  assert.equal(result.profile_fingerprint, calls[1][1].profile_fingerprint)
})

test('Task 2D browser client surfaces backend sync failure', async () => {
  assert.equal(existsSync(clientSyncPath), true, 'Task 2D browser sync client must exist')
  if (!existsSync(clientSyncPath)) return

  const { requestNightFlightProfileSync } = await import(clientSyncPath)
  const fetchImpl = async () => ({
    ok: false,
    async json() { return { error: 'Night Flight profile sync failed' } },
  })

  await assert.rejects(
    requestNightFlightProfileSync({ searchProfile: {}, cv: null, fetchImpl }),
    /profile sync failed/i
  )
})

test('Task 2D route and Search Profile save wiring are present, with server sync before local success commit', () => {
  assert.equal(existsSync(routePath), true, 'Task 2D authenticated sync route must exist')
  const routeSource = existsSync(routePath) ? readFileSync(routePath, 'utf8') : ''
  assert.match(routeSource, /requireUser/)
  assert.match(routeSource, /createServerSupabaseClient/)
  assert.match(routeSource, /auth\.user\.id/)
  assert.doesNotMatch(routeSource, /body\?\.userId|body\.userId/)

  const pageSource = readFileSync(pagePath, 'utf8')
  assert.match(pageSource, /requestNightFlightProfileSync/)
  const saveStart = pageSource.indexOf('async function saveProfile()')
  const localCommit = pageSource.indexOf("localStorage.setItem('applypilot-profile'", saveStart)
  const serverSync = pageSource.indexOf('await requestNightFlightProfileSync', saveStart)
  assert.ok(saveStart >= 0 && serverSync > saveStart, 'Search Profile save must await Night Flight server sync')
  assert.ok(localCommit > serverSync, 'Server sync must complete before local profile is marked saved')
})
