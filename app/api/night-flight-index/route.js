import {NIGHT_PILOT_ENABLED} from '../../lib/night-pilot-feature.js'
import { NextResponse } from 'next/server'
import { resolveNightFlightRequestContext } from '../../lib/night-flight-preview-context.js'
import { loadNightFlightIndex } from '../../lib/night-flight-index.js'

export const dynamic='force-dynamic'

export async function GET(){
  if(!NIGHT_PILOT_ENABLED) return NextResponse.json({error:'Night Pilot is disabled'},{status:410})
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  try{
    const index=await loadNightFlightIndex({supabase,userId:auth.user.id})
    return NextResponse.json(index)
  }catch(error){
    console.error('night-flight-index read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight index could not be loaded.'},{status:500})
  }
}
