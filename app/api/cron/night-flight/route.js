import {NextResponse} from 'next/server'
import {createAdminSupabaseClient} from '../../../lib/supabase/admin.js'
import {runNightFlightScheduler} from '../../../lib/night-flight-scheduler.js'

export const dynamic='force-dynamic'

const clean=value=>String(value??'').trim()

export async function GET(request){
  const secret=clean(process.env.CRON_SECRET)
  const authorization=clean(request.headers.get('authorization'))
  if(!secret||authorization!==`Bearer ${secret}`){
    return NextResponse.json({error:'Unauthorized'},{status:401})
  }

  try{
    const supabase=createAdminSupabaseClient()
    const result=await runNightFlightScheduler({supabase})
    return NextResponse.json(result)
  }catch(error){
    console.error('[night-flight-cron] failed',clean(error?.message||error))
    return NextResponse.json({error:'Night Flight scheduler failed'},{status:500})
  }
}
