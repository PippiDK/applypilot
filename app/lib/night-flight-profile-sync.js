import { buildNightFlightProfileState } from './night-flight-profile-state.js'
import { persistNightFlightProfileState } from './night-flight-profile-store.js'

export async function syncNightFlightProfileSave({
  supabase,
  userId,
  searchProfile = {},
  cv = null,
  now,
} = {}) {
  const state = buildNightFlightProfileState({ searchProfile, cv })
  return persistNightFlightProfileState({ supabase, userId, state, now })
}
