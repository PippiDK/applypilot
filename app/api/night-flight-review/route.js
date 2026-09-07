import { NextResponse } from 'next/server'
import { resolveNightFlightRequestContext } from '../../lib/night-flight-preview-context.js'
import { loadNightFlightMorningReview } from '../../lib/night-flight-review.js'
import { recoverFailedNightFlightMatch } from '../../lib/night-flight-manual-recovery.js'

export const dynamic='force-dynamic'
const clean=value=>String(value??'').trim()

export async function GET(){
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  try{
    const review=await loadNightFlightMorningReview({supabase,userId:auth.user.id})
    return NextResponse.json({review})
  }catch(error){
    console.error('night-flight-review read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight review could not be loaded.'},{status:500})
  }
}

export async function POST(request){
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const runId=clean(body?.runId)
    const jobKey=clean(body?.jobKey)
    if(!runId||!jobKey){
      return NextResponse.json({error:'runId and jobKey are required.'},{status:400})
    }

    await recoverFailedNightFlightMatch({
      supabase,
      userId:auth.user.id,
      runId,
      jobKey,
    })
    const review=await loadNightFlightMorningReview({supabase,userId:auth.user.id})
    return NextResponse.json({review})
  }catch(error){
    const message=error?.message||'Night Flight Match recovery failed.'
    const status=/only for FAILED|not available|no longer FAILED|requires userId/i.test(message)?409:500
    console.error('night-flight-review recovery error',{message})
    return NextResponse.json({error:message},{status})
  }
}
