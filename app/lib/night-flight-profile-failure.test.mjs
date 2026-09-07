import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const helperUrl = new URL('./night-flight-profile-failure.js', import.meta.url)
const pageUrl = new URL('../page.js', import.meta.url)

test('Task 2E converts a Night Flight sync failure into visible stale state without rethrowing', async () => {
  assert.equal(existsSync(helperUrl), true, 'Task 2E failure helper must exist')
  if (!existsSync(helperUrl)) return

  const { attemptNightFlightProfileSync } = await import(helperUrl)
  const result = await attemptNightFlightProfileSync({
    sync: async () => { throw new Error('database unavailable') },
    searchProfile: { roles: ['Senior Project Manager'] },
    cv: { text: 'Primary CV', sourceVersion: 'cv-7' },
  })

  assert.deepEqual(result, {
    stale: true,
    error: 'database unavailable',
  })
})

test('Task 2E clears stale state after the next successful Night Flight sync', async () => {
  assert.equal(existsSync(helperUrl), true, 'Task 2E failure helper must exist')
  if (!existsSync(helperUrl)) return

  const { attemptNightFlightProfileSync } = await import(helperUrl)
  const result = await attemptNightFlightProfileSync({
    sync: async () => ({ ok: true }),
    searchProfile: {},
    cv: null,
  })

  assert.deepEqual(result, {
    stale: false,
    error: '',
  })
})

test('Task 2E Search Profile save commits locally after the guarded sync attempt and renders a stale-backend warning', () => {
  const page = readFileSync(pageUrl, 'utf8')
  const attemptIndex = page.indexOf('await attemptNightFlightProfileSync(')
  const localSaveIndex = page.indexOf("localStorage.setItem('applypilot-profile',JSON.stringify(saved))")

  assert.ok(page.includes("import {attemptNightFlightProfileSync} from './lib/night-flight-profile-failure.js'"))
  assert.ok(page.includes("const [nightFlightSyncWarning,setNightFlightSyncWarning]=useState('')"))
  assert.ok(attemptIndex >= 0, 'saveProfile must use the guarded Task 2E sync attempt')
  assert.ok(localSaveIndex > attemptIndex, 'local profile save must happen after the guarded sync attempt')
  assert.ok(page.includes('setNightFlightSyncWarning(syncResult.stale?syncResult.error:\'\')'))
  assert.ok(page.includes('Night Flight backend is not synced'))
})
