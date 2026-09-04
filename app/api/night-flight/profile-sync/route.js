import {NextResponse} from 'next/server'
import {requireUser} from '../../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../../lib/supabase/server.js'
import {buildNightFlightProfileState} from '../../../lib/night-flight-profile-sync.js'

export const dynamic='force-dynamic'

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const state=buildNightFlightProfileState({searchProfile:body?.searchProfile,cv:body?.cv})

    if(process.env.VERCEL_ENV==='preview'){
      return NextResponse.json({ok:true,preview:true,profileFingerprint:state.profile_fingerprint})
    }

    const supabase=await createServerSupabaseClient()
    const row={user_id:auth.user.id,...state}
    const {error}=await supabase.from('night_flight_profiles').upsert(row,{onConflict:'user_id'})
    if(error) throw error

    return NextResponse.json({ok:true,profileFingerprint:state.profile_fingerprint,syncedAt:state.synced_at})
  }catch(error){
    console.error('night-flight profile sync error',{code:String(error?.code||'SYNC_FAILED')})
    return NextResponse.json({error:'Night Flight profile sync failed safely.'},{status:500})
  }
}
