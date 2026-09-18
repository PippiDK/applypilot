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

async function loadNightFlightRunJobRows({supabase,runId}){
  const {data,error}=await supabase
    .from('night_flight_jobs')
    .select('job_key,job_snapshot')
    .eq('run_id',runId)
  if(error) throw new Error(`Night Flight jobs read failed: ${error.message||'unknown Supabase error'}`)
  return Array.isArray(data)?data:[]
}

export async function loadAppliedHistoryJobIdsForNightFlightRun({
  supabase,
  userId,
  runId,
  jobRows,
}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const run=clean(runId)
  if(!user||!run) throw new Error('Night Flight Applied History lookup requires userId and runId')

  const rows=Array.isArray(jobRows)?jobRows:await loadNightFlightRunJobRows({supabase,runId:run})
  const jobIds=[...new Set(rows.map(nightFlightAppliedHistoryJobId).filter(Boolean))]
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

async function updateAlreadyApplied({supabase,runId,jobKeys,value}){
  if(!jobKeys.length) return
  const {error}=await supabase
    .from('night_flight_jobs')
    .update({already_applied:value})
    .eq('run_id',runId)
    .in('job_key',jobKeys)
  if(error) throw new Error(`Night Flight Already Applied update failed: ${error.message||'unknown Supabase error'}`)
}

export async function reconcileNightFlightAppliedHistory({supabase,userId,runId}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const run=clean(runId)
  if(!user||!run) throw new Error('Night Flight Applied History reconciliation requires userId and runId')

  const jobRows=await loadNightFlightRunJobRows({supabase,runId:run})
  const appliedIds=await loadAppliedHistoryJobIdsForNightFlightRun({supabase,userId:user,runId:run,jobRows})
  const matched=[]
  const unmatched=[]

  for(const row of jobRows){
    const key=clean(row?.job_key)
    if(!key) continue
    const appliedId=nightFlightAppliedHistoryJobId(row)
    ;(appliedId&&appliedIds.has(appliedId)?matched:unmatched).push(key)
  }

  await updateAlreadyApplied({supabase,runId:run,jobKeys:matched,value:true})
  await updateAlreadyApplied({supabase,runId:run,jobKeys:unmatched,value:false})

  return {runId:run,jobsChecked:matched.length+unmatched.length,alreadyApplied:matched.length}
}
