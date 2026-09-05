import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createServerSupabaseClient } from '../../lib/supabase/server.js'
import { loadNightFlightStatus } from '../../lib/night-flight-status.js'

export const dynamic='force-dynamic'

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const supabase=await createServerSupabaseClient()
    const status=await loadNightFlightStatus({supabase,userId:auth.user.id})
    return NextResponse.json({status})
  }catch(error){
    console.error('night-flight-status read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight status could not be loaded.'},{status:500})
  }
}
