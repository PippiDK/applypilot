import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createServerSupabaseClient } from '../../lib/supabase/server.js'
import { loadNightFlightMorningReview } from '../../lib/night-flight-review.js'

export const dynamic='force-dynamic'

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const supabase=await createServerSupabaseClient()
    const review=await loadNightFlightMorningReview({supabase,userId:auth.user.id})
    return NextResponse.json({review})
  }catch(error){
    console.error('night-flight-review read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight review could not be loaded.'},{status:500})
  }
}
