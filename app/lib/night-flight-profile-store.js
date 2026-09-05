export async function persistNightFlightProfileState({
  supabase,
  userId,
  state,
  now = new Date().toISOString(),
} = {}) {
  if (!userId) throw new Error('Authenticated user is required')
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('Supabase client is required')
  }

  const profileState = state || {}
  const payload = {
    user_id: userId,
    search_profile: profileState.search_profile ?? {},
    cv_text: typeof profileState.cv_text === 'string' ? profileState.cv_text : '',
    cv_source_version:
      profileState.cv_source_version == null ? '' : String(profileState.cv_source_version),
    profile_fingerprint:
      profileState.profile_fingerprint == null ? '' : String(profileState.profile_fingerprint),
    synced_at: now,
    updated_at: now,
  }

  const { error } = await supabase
    .from('night_flight_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Night Flight profile sync failed: ${error.message || 'unknown Supabase error'}`)
  }

  return payload
}
