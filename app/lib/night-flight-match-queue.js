export const DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS=3
export const DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS=15*60*1000

const SELECT_FIELDS='run_id,job_key,source,job_snapshot,area,status,attempts,last_error,match_cache_key,processed_at,created_at,updated_at'
const CLAIMABLE_STATUSES=['QUEUED','RETRY','PROCESSING']
const ACTIVE_STATUSES=new Set(['QUEUED','PROCESSING','RETRY'])
const TASK14_TRACE_RUN='e1e5c106-7962-43f8-b6f0-8a3970f3922e'

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight queue requires Supabase')
}

function requireRunId(runId){
  const value=clean(runId)
  if(!value) throw new Error('Night Flight queue requires runId')
  return value
}

function resolveNow(now){
  const value=typeof now==='function'?now():(now??new Date())
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime())) throw new Error('Night Flight queue time is invalid')
  return date
}

function positiveInteger(value,fallback){
  const number=Number(value)
  return Number.isInteger(number)&&number>0?number:fallback
}

function positiveNumber(value,fallback){
  const number=Number(value)
  return Number.isFinite(number)&&number>0?number:fallback
}

function safeErrorMessage(error){
  const text=clean(error?.message||error||'Night Flight Match failed')
  return (text||'Night Flight Match failed').slice(0,500)
}

function assertQueryResult(result,label){
  if(result?.error) throw new Error(`${label}: ${result.error.message||'unknown Supabase error'}`)
  return result?.data??null
}

function isStaleProcessing(row,now,leaseMs){
  if(row?.status!=='PROCESSING') return false
  const updatedAt=Date.parse(row?.updated_at||'')
  return !Number.isFinite(updatedAt)||updatedAt<=now.getTime()-leaseMs
}

function claimPriority(row){
  if(row?.status==='QUEUED') return 0
  if(row?.status==='PROCESSING') return 1
  if(row?.status==='RETRY') return 2
  return 99
}

async function loadClaimCandidates({supabase,runId}){
  const result=await supabase
    .from('night_flight_jobs')
    .select(SELECT_FIELDS)
    .eq('run_id',runId)
    .in('status',CLAIMABLE_STATUSES)
    .order('created_at',{ascending:true})
  const rows=assertQueryResult(result,'Night Flight queue read failed')
  return Array.isArray(rows)?rows:[]
}

async function casUpdateJob({supabase,row,payload}){
  const result=await supabase
    .from('night_flight_jobs')
    .update(payload)
    .eq('run_id',row.run_id)
    .eq('job_key',row.job_key)
    .eq('status',row.status)
    .eq('attempts',Number(row?.attempts||0))
    .select(SELECT_FIELDS)
    .maybeSingle()
  return assertQueryResult(result,'Night Flight queue update failed')
}

async function expireExhaustedCandidate({supabase,row,now,maxAttempts,leaseMs}){
  const attempts=Number(row?.attempts||0)
  const exhausted=attempts>=maxAttempts
  if(!exhausted) return false
  if(row?.status==='PROCESSING'&&!isStaleProcessing(row,now,leaseMs)) return false
  if(row?.status!=='PROCESSING'&&row?.status!=='RETRY') return false

  const stamp=now.toISOString()
  await casUpdateJob({
    supabase,
    row,
    payload:{
      status:'FAILED',
      last_error:row?.last_error||'Night Flight Match retry budget exhausted',
      processed_at:stamp,
      updated_at:stamp,
    },
  })
  return true
}

export async function claimNextNightFlightJob({
  supabase,
  runId,
  now=new Date(),
  leaseMs=DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS,
  maxAttempts=DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS,
}={}){
  requireSupabase(supabase)
  const id=requireRunId(runId)
  const current=resolveNow(now)
  const lease=positiveNumber(leaseMs,DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS)
  const attemptsLimit=positiveInteger(maxAttempts,DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS)
  const trace=process.env.VERCEL_ENV==='preview'&&id===TASK14_TRACE_RUN

  for(let pass=0;pass<3;pass+=1){
    const rows=await loadClaimCandidates({supabase,runId:id})
    if(trace) console.info('[task14-queue-trace] loaded',JSON.stringify(rows.map(row=>({jobKey:row.job_key,status:row.status,attempts:row.attempts,updatedAt:row.updated_at}))))
    const candidates=[]

    for(const row of rows){
      if(await expireExhaustedCandidate({supabase,row,now:current,maxAttempts:attemptsLimit,leaseMs:lease})) continue
      if(Number(row?.attempts||0)>=attemptsLimit) continue
      if(row?.status==='PROCESSING'&&!isStaleProcessing(row,current,lease)) continue
      candidates.push(row)
    }

    candidates.sort((a,b)=>claimPriority(a)-claimPriority(b)||String(a?.created_at||'').localeCompare(String(b?.created_at||'')))
    if(trace) console.info('[task14-queue-trace] candidates',JSON.stringify(candidates.map(row=>({jobKey:row.job_key,status:row.status,attempts:row.attempts}))))
    if(candidates.length===0) return null

    for(const row of candidates){
      const stamp=current.toISOString()
      const claimed=await casUpdateJob({
        supabase,
        row,
        payload:{
          status:'PROCESSING',
          attempts:Number(row?.attempts||0)+1,
          updated_at:stamp,
        },
      })
      if(trace) console.info('[task14-queue-trace] claim',JSON.stringify({jobKey:row.job_key,status:row.status,attempts:row.attempts,claimed:Boolean(claimed),claimedStatus:claimed?.status||null,claimedAttempts:claimed?.attempts??null}))
      if(claimed) return claimed
    }
  }

  return null
}

function requireCurrentClaim(claimedJob){
  if(!claimedJob||claimedJob.status!=='PROCESSING'||!clean(claimedJob.run_id)||!clean(claimedJob.job_key)||!clean(claimedJob.updated_at)){
    throw new Error('Night Flight job claim is invalid')
  }
}

export async function completeNightFlightJob({supabase,claimedJob,matchCacheKey,now=new Date()}={}){
  requireSupabase(supabase)
  requireCurrentClaim(claimedJob)
  const stamp=resolveNow(now).toISOString()
  const ready=await casUpdateJob({
    supabase,
    row:claimedJob,
    payload:{
      status:'READY',
      match_cache_key:clean(matchCacheKey)||null,
      last_error:null,
      processed_at:stamp,
      updated_at:stamp,
    },
  })
  if(!ready) throw new Error('Night Flight job lease is no longer current')
  return ready
}

export async function failNightFlightJob({
  supabase,
  claimedJob,
  error,
  maxAttempts=DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS,
  now=new Date(),
}={}){
  requireSupabase(supabase)
  requireCurrentClaim(claimedJob)
  const attemptsLimit=positiveInteger(maxAttempts,DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS)
  const final=Number(claimedJob.attempts||0)>=attemptsLimit
  const stamp=resolveNow(now).toISOString()
  const failed=await casUpdateJob({
    supabase,
    row:claimedJob,
    payload:{
      status:final?'FAILED':'RETRY',
      last_error:safeErrorMessage(error),
      processed_at:final?stamp:null,
      updated_at:stamp,
    },
  })
  if(!failed) throw new Error('Night Flight job lease is no longer current')
  return failed
}

export async function reconcileNightFlightRun({supabase,runId,now=new Date()}={}){
  requireSupabase(supabase)
  const id=requireRunId(runId)
  const current=resolveNow(now)
  const jobsResult=await supabase
    .from('night_flight_jobs')
    .select('status')
    .eq('run_id',id)
  const jobs=assertQueryResult(jobsResult,'Night Flight run reconciliation read failed')
  const rows=Array.isArray(jobs)?jobs:[]
  const jobsReady=rows.filter(row=>row.status==='READY').length
  const jobsFailed=rows.filter(row=>row.status==='FAILED').length
  const jobsSkipped=rows.filter(row=>row.status==='SKIPPED_AREA').length
  const unfinished=rows.filter(row=>ACTIVE_STATUSES.has(row.status)).length

  let status='RUNNING'
  if(rows.length===0) status='NO_JOBS'
  else if(unfinished===0) status=jobsFailed>0?'READY_WITH_ERRORS':'READY'

  const final=status==='READY'||status==='READY_WITH_ERRORS'||status==='NO_JOBS'||status==='FAILED'
  const stamp=current.toISOString()
  const runResult=await supabase
    .from('night_flight_runs')
    .update({
      status,
      jobs_discovered:rows.length,
      jobs_ready:jobsReady,
      jobs_failed:jobsFailed,
      jobs_skipped:jobsSkipped,
      completed_at:final?stamp:null,
      updated_at:stamp,
    })
    .eq('id',id)
    .select('id,status,jobs_discovered,jobs_queued,jobs_ready,jobs_failed,jobs_skipped,completed_at,updated_at')
    .maybeSingle()
  assertQueryResult(runResult,'Night Flight run reconciliation update failed')

  return {
    runId:id,
    status,
    jobsDiscovered:rows.length,
    jobsReady,
    jobsFailed,
    jobsSkipped,
    unfinished,
  }
}

export async function processNightFlightQueue({
  supabase,
  runId,
  processJob,
  now=()=>new Date(),
  maxAttempts=DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS,
  leaseMs=DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS,
  maxJobs=Infinity,
}={}){
  requireSupabase(supabase)
  const id=requireRunId(runId)
  if(typeof processJob!=='function') throw new Error('Night Flight queue requires processJob')
  const attemptsLimit=positiveInteger(maxAttempts,DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS)
  const lease=positiveNumber(leaseMs,DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS)
  const limit=Number.isFinite(Number(maxJobs))?Math.max(0,Number(maxJobs)):Infinity
  let processed=0

  while(processed<limit){
    const claimed=await claimNextNightFlightJob({supabase,runId:id,now,leaseMs:lease,maxAttempts:attemptsLimit})
    if(!claimed) break

    try{
      const result=await processJob(claimed)
      await completeNightFlightJob({supabase,claimedJob:claimed,matchCacheKey:result?.matchCacheKey,now})
    }catch(error){
      await failNightFlightJob({supabase,claimedJob:claimed,error,maxAttempts:attemptsLimit,now})
    }
    processed+=1
  }

  return reconcileNightFlightRun({supabase,runId:id,now})
}
