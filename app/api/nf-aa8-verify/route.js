import {NextResponse} from 'next/server'
import {resolveNightFlightRequestContext} from '../../lib/night-flight-preview-context.js'
import {processNightFlightRunMatches} from '../../lib/night-flight-match-processor.js'

export const dynamic='force-dynamic'

const clean=value=>String(value??'').trim()

export async function GET(request){
  if(process.env.VERCEL_ENV!=='preview'){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  const runId=clean(new URL(request.url).searchParams.get('runId'))
  if(!runId) return NextResponse.json({error:'runId is required'},{status:400})

  try{
    const result=await processNightFlightRunMatches({
      supabase,
      userId:auth.user.id,
      runId,
    })
    return NextResponse.json({result})
  }catch(error){
    return NextResponse.json({error:error?.message||'Verification failed'},{status:500})
  }
}
