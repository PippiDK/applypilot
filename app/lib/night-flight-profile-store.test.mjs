import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const modulePath = new URL('./night-flight-profile-store.js', import.meta.url)

test('Task 2B upserts one coherent Night Flight profile row for the authenticated user', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2B profile store must exist')
  if (!existsSync(modulePath)) return

  const { persistNightFlightProfileState } = await import(modulePath)
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
  const state = {
    search_profile: { roles: ['Senior Project Manager'] },
    cv_text: 'Primary CV',
    cv_source_version: 'cv-7',
    profile_fingerprint: 'a'.repeat(64),
  }

  await persistNightFlightProfileState({ supabase, userId: 'user-1', state, now: '2026-09-05T18:00:00.000Z' })

  assert.equal(calls[0][1], 'night_flight_profiles')
  assert.deepEqual(calls[1][1], {
    user_id: 'user-1',
    ...state,
    synced_at: '2026-09-05T18:00:00.000Z',
    updated_at: '2026-09-05T18:00:00.000Z',
  })
  assert.deepEqual(calls[1][2], { onConflict: 'user_id' })
})

test('Task 2B rejects missing authenticated user before writing', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2B profile store must exist')
  if (!existsSync(modulePath)) return
  const { persistNightFlightProfileState } = await import(modulePath)

  let touched = false
  const supabase = { from() { touched = true } }

  await assert.rejects(
    persistNightFlightProfileState({ supabase, userId: '', state: {} }),
    /authenticated user/i
  )
  assert.equal(touched, false)
})

test('Task 2B surfaces Supabase write failures instead of silently continuing', async () => {
  assert.equal(existsSync(modulePath), true, 'Task 2B profile store must exist')
  if (!existsSync(modulePath)) return
  const { persistNightFlightProfileState } = await import(modulePath)

  const supabase = {
    from() {
      return {
        upsert() {
          return Promise.resolve({ error: { message: 'database unavailable' } })
        },
      }
    },
  }

  await assert.rejects(
    persistNightFlightProfileState({
      supabase,
      userId: 'user-1',
      state: {
        search_profile: {},
        cv_text: '',
        cv_source_version: '',
        profile_fingerprint: 'b'.repeat(64),
      },
    }),
    /database unavailable/i
  )
})
