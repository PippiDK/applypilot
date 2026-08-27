const nowIso=()=>new Date().toISOString()

function throwIf(error,message){
  if(error) throw new Error(error.message||message)
}

export function candidateRowsForUpsert(runId,candidates=[]){
  return (Array.isArray(candidates)?candidates:[]).map(candidate=>{
    const {foundBy,...candidateData}=candidate||{}
    return {
      run_id:runId,
      job_id:String(candidate?.jobId??''),
      candidate:candidateData,
      found_by:Array.isArray(foundBy)?foundBy:[],
      detail_status:'PENDING',
      updated_at:nowIso(),
    }
  }).filter(row=>row.job_id)
}

export function processedRowPatch(row={}){
  return {
    detail_status:row.detailStatus==='UNVERIFIED'?'UNVERIFIED':'PROCESSED',
    job:row.job??null,
    evaluation:row.evaluation??null,
    audit:row.audit??null,
    error:row.error??null,
    updated_at:nowIso(),
  }
}

function candidateFromRow(row={}){
  return {...(row.candidate||{}),jobId:String(row.job_id??''),foundBy:Array.isArray(row.found_by)?row.found_by:[]}
}

export function composeSearchRunResult(run={},candidateRows=[]){
  const rows=Array.isArray(candidateRows)?candidateRows:[]
  const jobs=rows
    .filter(row=>row.detail_status==='PROCESSED'&&row.job&&row.evaluation&&row.audit?.decision==='KEEP')
    .map(row=>({job:row.job,evaluation:row.evaluation}))
    .sort((a,b)=>Number(b.evaluation?.score||0)-Number(a.evaluation?.score||0)||(new Date(b.job?.publishedAt||0)-new Date(a.job?.publishedAt||0)))
  const audit=rows.map(row=>({jobId:String(row.job_id??''),title:row.job?.title||row.candidate?.title||'',company:row.job?.company||row.candidate?.company||'',...(row.audit||{})}))
  const fullJdProcessed=rows.filter(row=>row.detail_status==='PROCESSED'||row.detail_status==='UNVERIFIED').length
  const fullJdVerified=rows.filter(row=>row.detail_status==='PROCESSED').length
  return {
    runId:run.id,
    status:run.status,
    jobs,
    audit,
    coverage:run.coverage||{status:run.status==='ACCESS_LIMITED'?'ACCESS LIMITED':run.status==='COMPLETE'?'SEARCHED':'SEARCHING'},
    stats:{...(run.stats||{}),discovered:Number(run.stats?.discovered??rows.length),fullJdProcessed,fullJdVerified,returned:jobs.length,evaluated:jobs.length},
    fetchedAt:run.updated_at||null,
  }
}

export async function createPersistentSearchRun({supabase,userId,freshnessDays,unionSearchPlan,exclusionRules,discoveryState,evaluationVersion='profile-v1'}={}){
  const payload={
    user_id:userId,
    status:'DISCOVERING',
    freshness_days:Number(freshnessDays),
    union_search_plan:unionSearchPlan||{},
    exclusion_rules:Array.isArray(exclusionRules)?exclusionRules:[],
    evaluation_version:evaluationVersion,
    discovery_state:discoveryState||{},
    stats:{discovered:0,fullJdProcessed:0,fullJdVerified:0},
    coverage:{status:'SEARCHING',detail:null},
    updated_at:nowIso(),
  }
  const {data,error}=await supabase.from('search_runs').insert(payload).select('*').single()
  throwIf(error,'Could not create Search Run')
  return data
}

export async function loadPersistentSearchRun({supabase,userId,runId}={}){
  const {data:run,error:runError}=await supabase.from('search_runs').select('*').eq('id',runId).eq('user_id',userId).single()
  throwIf(runError,'Could not load Search Run')
  const {data:candidates,error:candidateError}=await supabase.from('search_candidates').select('*').eq('run_id',runId).order('created_at',{ascending:true})
  throwIf(candidateError,'Could not load Search Run candidates')
  return {run,candidates:candidates||[]}
}

export async function loadLatestActiveSearchRun({supabase,userId}={}){
  const {data,error}=await supabase.from('search_runs').select('*').eq('user_id',userId).in('status',['DISCOVERING','READING_JDS']).order('created_at',{ascending:false}).limit(1)
  throwIf(error,'Could not find active Search Run')
  const run=Array.isArray(data)?data[0]:null
  if(!run) return null
  const {data:candidates,error:candidateError}=await supabase.from('search_candidates').select('*').eq('run_id',run.id).order('created_at',{ascending:true})
  throwIf(candidateError,'Could not load active Search Run candidates')
  return {run,candidates:candidates||[]}
}

export async function updatePersistentSearchRun({supabase,userId,runId,patch}={}){
  const payload={...patch,updated_at:nowIso()}
  const {data,error}=await supabase.from('search_runs').update(payload).eq('id',runId).eq('user_id',userId).select('*').single()
  throwIf(error,'Could not update Search Run')
  return data
}

export async function upsertPersistentCandidates({supabase,runId,candidates}={}){
  const rows=candidateRowsForUpsert(runId,candidates)
  if(!rows.length) return []
  const {data,error}=await supabase.from('search_candidates').upsert(rows,{onConflict:'run_id,job_id',ignoreDuplicates:false}).select('*')
  throwIf(error,'Could not checkpoint Search Run candidates')
  return data||[]
}

export async function loadPendingPersistentCandidates({supabase,runId,limit=30}={}){
  const {data,error}=await supabase.from('search_candidates').select('*').eq('run_id',runId).eq('detail_status','PENDING').order('created_at',{ascending:true}).limit(Math.min(30,Math.max(1,Number(limit)||30)))
  throwIf(error,'Could not load pending Search Run candidates')
  return (data||[]).map(candidateFromRow)
}

export async function saveProcessedPersistentCandidates({supabase,runId,processed=[]}={}){
  for(const row of Array.isArray(processed)?processed:[]){
    const patch=processedRowPatch(row)
    const {error}=await supabase.from('search_candidates').update(patch).eq('run_id',runId).eq('job_id',String(row?.candidate?.jobId??''))
    throwIf(error,'Could not checkpoint processed Search Run candidate')
  }
}
