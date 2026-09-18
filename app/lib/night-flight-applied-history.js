const clean=value=>String(value??'').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight Applied History lookup requires Supabase')
}

export function nightFlightAppliedHistoryJobId(row={}){
  const snapshot=row?.job_snapshot&&typeof row.job_snapshot==='object'?row.job_snapshot:{}
  const explicit=clean(snapshot.sourceJobId||snapshot.jobId)
  if(explicit) return explicit

  const key=clean(row?.job_key)
  const linkedIn=key.match(/^linkedin:(.+)$/i)
  return clean(linkedIn?.[1]||key)
}

export async function loadAppliedHistoryJobIdsForNightFlightRun({
  supabase,
  userId,
  runId,
}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const run=clean(runId)
  if(!user||!run) throw new Error('Night Flight Applied History lookup requires userId and runId')

  const {data:jobRows,error:jobsError}=await supabase
    .from('night_flight_jobs')
    .select('job_key,job_snapshot')
    .eq('run_id',run)
  if(jobsError) throw new Error(`Night Flight jobs read failed: ${jobsError.message||'unknown Supabase error'}`)

  const jobIds=[...new Set((jobRows||[])
    .map(nightFlightAppliedHistoryJobId)
    .filter(Boolean))]

  if(!jobIds.length) return new Set()

  const {data:appliedRows,error:appliedError}=await supabase
    .from('applied_jobs')
    .select('job_id')
    .eq('user_id',user)
    .in('job_id',jobIds)
  if(appliedError) throw new Error(`Applied History batch lookup failed: ${appliedError.message||'unknown Supabase error'}`)

  const requested=new Set(jobIds)
  return new Set((appliedRows||[])
    .map(row=>clean(row?.job_id))
    .filter(jobId=>jobId&&requested.has(jobId)))
}
