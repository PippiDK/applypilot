import {NextResponse} from 'next/server'
import {resolveNightFlightRequestContext} from '../../../lib/night-flight-preview-context.js'
import {executeManualNightFlight} from '../../../lib/night-flight-manual-control.js'

export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(){
  if(process.env.VERCEL_ENV!=='preview'){
    return NextResponse.json({error:'Not available'},{status:404})
  }
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response
  try{
    const result=await executeManualNightFlight({
      supabase,
      userId:auth.user.id,
      mode:'start',
      now:new Date(),
    })
    return NextResponse.json(result)
  }catch(error){
    console.error('[night-flight-preview-refresh] failed',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Pilot preview refresh failed.'},{status:500})
  }
}
