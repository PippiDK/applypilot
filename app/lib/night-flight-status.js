function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight status requires Supabase')
}

const clean=value=>String(value??'').trim()

export async function loadNightFlightStatus({supabase,userId}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  if(!user) throw new Error('Authenticated user is required')

  const {data:run,error:runError}=await supabase
    .from('night_flight_runs')
    .select('id,user_id,target_date,status')
    .eq('user_id',user)
    .order('target_date',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(runError) throw new Error(`Night Flight status run read failed: ${runError.message||'unknown Supabase error'}`)
  if(!run) return null

  const {data:jobRows,error:jobsError}=await supabase
    .from('night_flight_jobs')
    .select('status')
    .eq('run_id',run.id)
  if(jobsError) throw new Error(`Night Flight status jobs read failed: ${jobsError.message||'unknown Supabase error'}`)

  const rows=(jobRows||[]).filter(row=>row?.status!=='SKIPPED_AREA')
  const ready=rows.filter(row=>row?.status==='READY').length
  const failed=rows.filter(row=>row?.status==='FAILED').length

  return {
    run:{id:run.id,targetDate:run.target_date,status:run.status},
    progress:{
      ready,
      failed,
      total:rows.length,
      remaining:Math.max(0,rows.length-ready-failed),
    },
  }
}
