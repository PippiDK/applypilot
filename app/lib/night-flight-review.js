function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight review requires Supabase')
}

const clean=value=>String(value??'').trim()

export async function loadNightFlightMorningReview({supabase,userId}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  if(!user) throw new Error('Authenticated user is required')

  const {data:run,error:runError}=await supabase
    .from('night_flight_runs')
    .select('id,user_id,target_date,status,jobs_discovered,jobs_ready,jobs_failed,jobs_skipped,completed_at,created_at')
    .eq('user_id',user)
    .order('target_date',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(runError) throw new Error(`Night Flight review run read failed: ${runError.message||'unknown Supabase error'}`)
  if(!run) return null

  const {data:jobRows,error:jobsError}=await supabase
    .from('night_flight_jobs')
    .select('run_id,job_key,source,job_snapshot,area,status,last_error,match_cache_key,processed_at,created_at')
    .eq('run_id',run.id)
    .order('created_at',{ascending:true})
  if(jobsError) throw new Error(`Night Flight review jobs read failed: ${jobsError.message||'unknown Supabase error'}`)

  const primaryRows=(jobRows||[]).filter(row=>row?.status!=='SKIPPED_AREA')
  const readyCacheKeys=[...new Set(primaryRows
    .filter(row=>row?.status==='READY'&&clean(row?.match_cache_key))
    .map(row=>clean(row.match_cache_key)))]

  let cacheRows=[]
  if(readyCacheKeys.length){
    const {data,error:cacheError}=await supabase
      .from('expertise_match_cache')
      .select('cache_key,analysis')
      .eq('user_id',user)
      .in('cache_key',readyCacheKeys)
    if(cacheError) throw new Error(`Night Flight review Match cache read failed: ${cacheError.message||'unknown Supabase error'}`)
    cacheRows=data||[]
  }

  const analysisByKey=new Map(cacheRows.map(row=>[clean(row?.cache_key),row?.analysis??null]))
  const jobs=primaryRows.map(row=>({
    key:row.job_key,
    source:row.source,
    area:row.area??null,
    status:row.status,
    lastError:row.last_error||null,
    matchCacheKey:row.match_cache_key||null,
    processedAt:row.processed_at||null,
    job:row.job_snapshot||{},
    analysis:row.status==='READY'&&row.match_cache_key
      ? analysisByKey.get(clean(row.match_cache_key))??null
      : null,
  }))

  return {
    run:{
      id:run.id,
      targetDate:run.target_date,
      status:run.status,
      completedAt:run.completed_at||null,
      createdAt:run.created_at||null,
    },
    counts:{
      ready:jobs.filter(job=>job.status==='READY').length,
      failed:jobs.filter(job=>job.status==='FAILED').length,
    },
    jobs,
  }
}
