import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const modulePath = new URL('./night-flight-profile-state.js', import.meta.url)

test('Task 2A provides a deterministic coherent Search Profile and primary CV state', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2A profile-state helper must exist')
  if (!existsSync(modulePath)) return

  const { buildNightFlightProfileState } = await import(modulePath)
  const input = {
    searchProfile: { roles: ['Senior Project Manager'], locations: ['Copenhagen'], remote: true },
    cv: { text: 'Current primary CV', sourceVersion: 'cv-7' },
  }

  const first = buildNightFlightProfileState(input)
  const second = buildNightFlightProfileState({
    searchProfile: { remote: true, locations: ['Copenhagen'], roles: ['Senior Project Manager'] },
    cv: { sourceVersion: 'cv-7', text: 'Current primary CV' },
  })

  assert.deepEqual(first.search_profile, input.searchProfile)
  assert.equal(first.cv_text, 'Current primary CV')
  assert.equal(first.cv_source_version, 'cv-7')
  assert.match(first.profile_fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(first.profile_fingerprint, second.profile_fingerprint, 'object key order must not change the fingerprint')
})

test('Task 2A fingerprint changes when Search Profile changes', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2A profile-state helper must exist')
  if (!existsSync(modulePath)) return
  const { buildNightFlightProfileState } = await import(modulePath)

  const before = buildNightFlightProfileState({ searchProfile: { roles: ['PM'] }, cv: { text: 'CV', sourceVersion: '1' } })
  const after = buildNightFlightProfileState({ searchProfile: { roles: ['Delivery Manager'] }, cv: { text: 'CV', sourceVersion: '1' } })

  assert.notEqual(before.profile_fingerprint, after.profile_fingerprint)
})

test('Task 2A fingerprint changes when primary CV changes', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2A profile-state helper must exist')
  if (!existsSync(modulePath)) return
  const { buildNightFlightProfileState } = await import(modulePath)

  const before = buildNightFlightProfileState({ searchProfile: { roles: ['PM'] }, cv: { text: 'Old CV', sourceVersion: '1' } })
  const after = buildNightFlightProfileState({ searchProfile: { roles: ['PM'] }, cv: { text: 'New CV', sourceVersion: '2' } })

  assert.notEqual(before.profile_fingerprint, after.profile_fingerprint)
})

test('Task 2A represents removed primary CV as an empty CV state with a new fingerprint', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2A profile-state helper must exist')
  if (!existsSync(modulePath)) return
  const { buildNightFlightProfileState } = await import(modulePath)

  const withCv = buildNightFlightProfileState({ searchProfile: { roles: ['PM'] }, cv: { text: 'CV', sourceVersion: '1' } })
  const withoutCv = buildNightFlightProfileState({ searchProfile: { roles: ['PM'] }, cv: null })

  assert.equal(withoutCv.cv_text, '')
  assert.equal(withoutCv.cv_source_version, '')
  assert.match(withoutCv.profile_fingerprint, /^[a-f0-9]{64}$/)
  assert.notEqual(withCv.profile_fingerprint, withoutCv.profile_fingerprint)
})
