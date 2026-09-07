export async function attemptNightFlightProfileSync({
  sync,
  searchProfile,
  cv,
} = {}) {
  try {
    await sync({ searchProfile: searchProfile || {}, cv: cv || null })
    return { stale: false, error: '' }
  } catch (error) {
    return {
      stale: true,
      error: error?.message || 'Night Flight profile sync failed',
    }
  }
}
