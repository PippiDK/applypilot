import { NextResponse } from 'next/server'
import { resolveNightFlightRequestContext } from '../../lib/night-flight-preview-context.js'
import { syncNightFlightProfileSave } from '../../lib/night-flight-profile-sync.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const {auth,supabase} = await resolveNightFlightRequestContext()
  if (!auth.user) return auth.response

  try {
    const body = await request.json()
    const persisted = await syncNightFlightProfileSave({
      supabase,
      userId: auth.user.id,
      searchProfile: body?.searchProfile || {},
      cv: body?.cv || null,
    })

    return NextResponse.json({
      profileFingerprint: persisted.profile_fingerprint,
      syncedAt: persisted.synced_at,
    })
  } catch (error) {
    console.error('night-flight-profile sync error', { message: error?.message || 'unknown' })
    return NextResponse.json(
      { error: error?.message || 'Night Flight profile sync failed' },
      { status: 500 }
    )
  }
}
