import { createHash } from 'node:crypto'

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])])
    )
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value))
}

export function buildNightFlightProfileState({ searchProfile = {}, cv = null } = {}) {
  const search_profile = searchProfile || {}
  const cv_text = typeof cv?.text === 'string' ? cv.text : ''
  const cv_source_version = cv?.sourceVersion == null ? '' : String(cv.sourceVersion)
  const fingerprintPayload = { search_profile, cv_text, cv_source_version }
  const profile_fingerprint = createHash('sha256')
    .update(stableStringify(fingerprintPayload))
    .digest('hex')

  return {
    search_profile,
    cv_text,
    cv_source_version,
    profile_fingerprint,
  }
}
