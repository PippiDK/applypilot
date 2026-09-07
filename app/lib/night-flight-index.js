const clean=value=>String(value??'').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight index requires Supabase')
}

function assertQuery(result,label){
  if(result?.error) throw new Error(`${label}: ${result.error.message||'unknown Supabase error'}`)
  return Array.isArray(result?.data)?result.data:[]
}

export async function loadNightFlightIndex({supabase,userId}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  if(!user) throw new Error('Authenticated user is required')

  const runs=assertQuery(await supabase
    .from('night_flight_runs')
    .select('id,target_date')
    .eq('user_id',user)
    .order('target_date',{ascending:false}),
  'Night Flight index runs read failed')

  if(!runs.length) return {jobs:{}}

  const runIds=runs.map(run=>clean(run?.id)).filter(Boolean)
  if(!runIds.length) return {jobs:{}}
  const runRank=new Map(runIds.map((id,index)=>[id,index]))

  const rows=assertQuery(await supabase
    .from('night_flight_jobs')
    .select('run_id,job_key,source,job_snapshot,status,match_cache_key,processed_at')
    .in('run_id',runIds)
    .eq('status','READY'),
  'Night Flight index jobs read failed')

  const readyRows=rows
    .filter(row=>clean(row?.job_key))
    .sort((a,b)=>(runRank.get(clean(a?.run_id))??Number.MAX_SAFE_INTEGER)-(runRank.get(clean(b?.run_id))??Number.MAX_SAFE_INTEGER))

  const cacheKeys=[...new Set(readyRows.map(row=>clean(row?.match_cache_key)).filter(Boolean))]
  let cacheRows=[]
  if(cacheKeys.length){
    cacheRows=assertQuery(await supabase
      .from('expertise_match_cache')
      .select('cache_key,analysis')
      .eq('user_id',user)
      .in('cache_key',cacheKeys),
    'Night Flight index Match cache read failed')
  }

  const analysisByKey=new Map(cacheRows.map(row=>[clean(row?.cache_key),row?.analysis??null]))
  const jobs={}

  for(const row of readyRows){
    const key=clean(row.job_key)
    if(jobs[key]) continue
    const matchCacheKey=clean(row.match_cache_key)||null
    jobs[key]={
      processed:true,
      source:clean(row.source)||null,
      matchCacheKey,
      processedAt:row.processed_at||null,
      job:row.job_snapshot||{},
      analysis:matchCacheKey?analysisByKey.get(matchCacheKey)??null:null,
    }
  }

  return {jobs}
}
