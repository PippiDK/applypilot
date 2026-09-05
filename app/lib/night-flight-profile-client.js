export async function requestNightFlightProfileSync({
  searchProfile,
  cv,
  fetchImpl = fetch,
} = {}) {
  const res = await fetchImpl('/api/night-flight-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchProfile: searchProfile || {}, cv: cv || null }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Night Flight profile sync failed')
  return data
}
