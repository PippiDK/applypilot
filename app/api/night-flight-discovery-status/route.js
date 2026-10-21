import {NextResponse} from 'next/server'
import {resolveNightFlightRequestContext} from '../../lib/night-flight-preview-context.js'
import {createAdminSupabaseClient} from '../../lib/supabase/admin.js'

export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Read-only owner-scoped progress. Never expose CV, profile, candidate or JD snapshots. */
export async function GET(){
 const {auth}=await resolveNightFlightRequestContext()
 if(!auth.user) return auth.response
 // Preview synthetic identities are not production database users.
 if(!UUID.test(String(auth.user.id||''))) return NextResponse.json({discovery:null})
 try{
  const db=createAdminSupabaseClient()
  const {data:run,error}=await db.from('night_flight_discovery_runs')
   .select('id,target_date,state,initialized')
   .eq('user_id',auth.user.id).order('target_date',{ascending:false}).limit(1).maybeSingle()
  if(error) throw error
  if(!run) return NextResponse.json({discovery:null})
  const {data:units,error:unitsError}=await db.from('night_flight_discovery_units')
   .select('phase,next_page,next_detail,last_error').eq('discovery_run_id',run.id)
  if(unitsError) throw unitsError
  const rows=units||[]
  return NextResponse.json({discovery:{
   targetDate:run.target_date,state:run.state,initialized:run.initialized,
   totalUnits:rows.length,completedUnits:rows.filter(row=>row.phase==='DONE').length,
   detailedJobs:rows.reduce((sum,row)=>sum+Number(row.next_detail||0),0),
   errors:rows.filter(row=>row.last_error).length,
  }})
 }catch(error){
  console.error('[night-flight-discovery-status] read failed',String(error?.message||error))
  return NextResponse.json({error:'Night Pilot discovery progress unavailable'},{status:500})
 }
}
