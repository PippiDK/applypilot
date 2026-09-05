import {NextResponse} from 'next/server'
import {createAdminSupabaseClient} from '../../../lib/supabase/admin.js'
import {runNightFlightScheduler} from '../../../lib/night-flight-scheduler.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(request){
  const secret=String(process.env.CRON_SECRET||'').trim()
  const authorization=request.headers.get('authorization')
  if(!secret) return NextResponse.json({error:'Cron is not configured.'},{status:503})
  if(authorization!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized'},{status:401})
  try{
    const supabase=createAdminSupabaseClient()
    const result=await runNightFlightScheduler({supabase,now:new Date()})
    return NextResponse.json(result)
  }catch(error){
    console.error('night-flight cron failed',error)
    return NextResponse.json({error:'Night Flight scheduler failed.'},{status:500})
  }
}
