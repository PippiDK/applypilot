export const SEARCH_SOURCE_IDS = ['linkedin', 'jobindex']
export const DEFAULT_SEARCH_SOURCES = [...SEARCH_SOURCE_IDS]
export const SEARCH_SOURCES_STORAGE_KEY = 'applypilot-search-sources'

export function normalizeSearchSources(value, { defaultWhenMissing = true } = {}) {
  if (!Array.isArray(value)) return defaultWhenMissing ? [...DEFAULT_SEARCH_SOURCES] : []
  return SEARCH_SOURCE_IDS.filter(id => value.includes(id))
}

export function readSearchSources(storage) {
  const raw = storage?.getItem?.(SEARCH_SOURCES_STORAGE_KEY)
  if (raw == null) return [...DEFAULT_SEARCH_SOURCES]
  try { return normalizeSearchSources(JSON.parse(raw), { defaultWhenMissing: false }) }
  catch { return [...DEFAULT_SEARCH_SOURCES] }
}

export function writeSearchSources(storage, sources) {
  const normalized = normalizeSearchSources(sources, { defaultWhenMissing: false })
  storage?.setItem?.(SEARCH_SOURCES_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}
