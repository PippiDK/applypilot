import {VALIDATION_DIAGNOSTIC_CODES} from './night-flight-validation-diagnostics.js'

export const DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS=3
export const DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS=15*60*1000
export const DEFAULT_NIGHT_FLIGHT_TIME_BUDGET_MS=210*1000
export const DEFAULT_NIGHT_FLIGHT_MIN_REMAINING_MS=20*1000
export const DEFAULT_NIGHT_FLIGHT_429_BACKOFF_MS=5*1000
export const DEFAULT_NIGHT_FLIGHT_MAX_429_WAIT_MS=30*1000

const SELECT_FIELDS='run_id,job_key,source,job_snapshot,area,status,attempts,last_error,match_cache_key,processed_at,created_at,updated_at'
const CLAIMABLE_STATUSES=['QUEUED','RETRY','PROCESSING']
const ACTIVE_STATUSES=new Set(['QUEUED','PROCESSING','RETRY'])

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const QUOTA_MARKER='PROVIDER_QUOTA'
const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))

function isProvider429(error){return clean(error?.code)==='AI_PROVIDER_HTTP_429'}
function isProviderQuota429(error){return isProvider429(error)&&error?.provider429Kind==='quota'}
function isQuotaBlockedRow(row){return row?.status==='RETRY'&&clean(row?.last_error).includes(QUOTA_MARKER)}
function retryDelayMs(error){
  const hinted=Number(error?.retryAfterMs)
  const desired=Number.isFinite(hinted)&&hinted>=0?hinted:DEFAULT_NIGHT_FLIGHT_429_BACKOFF_MS
  return Math.min(DEFAULT_NIGHT_FLIGHT_MAX_429_WAIT_MS,Math.max(1000,desired))
}

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
  const code=clean(error?.code)
  const safeCode=/^AI_[A-Z0-9_]{1,76}$/.test(code)
  const safeStage=/^[a-zA-Z0-9_-]{1,64} AI stage failed\.$/.test(text)
  const message=safeCode&&!safeStage?'Night Flight Match failed safely.':(text||'Night Flight Match failed')
  const diagnostic=String(error?.diagnosticCode??'')
  const quotaMarker=safeCode&&code==='AI_PROVIDER_HTTP_429'&&error?.provider429Kind==='quota'?` · ${QUOTA_MARKER}`:''
  const safeDiagnostic=safeCode&&code==='AI_EXPERTISE_VALIDATION'&&VALIDATION_DIAGNOSTIC_CODES.has(diagnostic)?` · ${diagnostic}`:''
  const index=error?.diagnosticIndex
  const safeIndex=safeDiagnostic&&Number.isInteger(index)&&index>=0&&index<18?` · ITEM_${index+1}`:''
  return `${safeCode?`${code} · `:''}${message}${quotaMarker}${safeDiagnostic}${safeIndex}`.slice(0,500)
}

function isNonRetryableError(error){
  const code=clean(error?.code)
  if(code==='AI_CONFIG_MISSING'||code==='AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS') return true
  if(/^AI_.*VALIDATION$/.test(code)) return true
  const status=Number(code.match(/^AI_PROVIDER_HTTP_(\d{3})$/)?.[1])
  return status>=400&&status<500&&status!==408&&status!==429
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
  if(isQuotaBlockedRow(row)) return -1
  if(row?.status==='QUEUED') return 0
  if(row?.status==='PROCESSING') return 1
  if(row?.status==='RETRY') return 2
  return 99
}

async function loadClaimCandidates({supabase,runId,onlyJobKey=''}){
  let query=supabase
    .from('night_flight_jobs')
    .select(SELECT_FIELDS)
    .eq('run_id',runId)
    .in('status',CLAIMABLE_STATUSES)
  if(onlyJobKey) query=query.eq('job_key',onlyJobKey)
  const result=await query.order('created_at',{ascending:true})
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
    .eq('updated_at',row.updated_at)
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
  excludeJobKeys=[],
  onlyJobKey='',
}={}){
  requireSupabase(supabase)
  const id=requireRunId(runId)
  const current=resolveNow(now)
  const lease=positiveNumber(leaseMs,DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS)
  const attemptsLimit=positiveInteger(maxAttempts,DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS)
  const excluded=new Set(Array.from(excludeJobKeys||[],clean).filter(Boolean))

  for(let pass=0;pass<3;pass+=1){
    const rows=await loadClaimCandidates({supabase,runId:id,onlyJobKey:clean(onlyJobKey)})
    const candidates=[]

    for(const row of rows){
      if(excluded.has(clean(row?.job_key))) continue
      if(await expireExhaustedCandidate({supabase,row,now:current,maxAttempts:attemptsLimit,leaseMs:lease})) continue
      if(Number(row?.attempts||0)>=attemptsLimit) continue
      if(row?.status==='PROCESSING'&&!isStaleProcessing(row,current,lease)) continue
      candidates.push(row)
    }

    candidates.sort((a,b)=>claimPriority(a)-claimPriority(b)||String(a?.created_at||'').localeCompare(String(b?.created_at||'')))
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
  const quota=isProviderQuota429(error)
  const final=!quota&&(isNonRetryableError(error)||Number(claimedJob.attempts||0)>=attemptsLimit)
  const stamp=resolveNow(now).toISOString()
  const failed=await casUpdateJob({
    supabase,
    row:claimedJob,
    payload:{
      status:final?'FAILED':'RETRY',
      attempts:quota?Math.max(0,Number(claimedJob.attempts||0)-1):Number(claimedJob.attempts||0),
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
  onlyJobKey='',
  timeBudgetMs=DEFAULT_NIGHT_FLIGHT_TIME_BUDGET_MS,
  minRemainingMs=DEFAULT_NIGHT_FLIGHT_MIN_REMAINING_MS,
  sleep=defaultSleep,
  clock=()=>Date.now(),
}={}){
  requireSupabase(supabase)
  const id=requireRunId(runId)
  if(typeof processJob!=='function') throw new Error('Night Flight queue requires processJob')
  if(typeof sleep!=='function'||typeof clock!=='function') throw new Error('Night Flight queue timing dependencies are invalid')
  const attemptsLimit=positiveInteger(maxAttempts,DEFAULT_NIGHT_FLIGHT_MAX_ATTEMPTS)
  const lease=positiveNumber(leaseMs,DEFAULT_NIGHT_FLIGHT_PROCESSING_LEASE_MS)
  const limit=Number.isFinite(Number(maxJobs))?Math.max(0,Number(maxJobs)):Infinity
  const budget=positiveNumber(timeBudgetMs,DEFAULT_NIGHT_FLIGHT_TIME_BUDGET_MS)
  const reserve=positiveNumber(minRemainingMs,DEFAULT_NIGHT_FLIGHT_MIN_REMAINING_MS)
  const started=Number(clock())
  const deadline=(Number.isFinite(started)?started:Date.now())+budget
  const remaining=()=>{
    const current=Number(clock())
    return Math.max(0,deadline-(Number.isFinite(current)?current:Date.now()))
  }
  let processed=0
  let stopReason=null
  const attemptedJobKeys=new Set()

  while(processed<limit){
    if(remaining()<=reserve){stopReason='TIME_BUDGET';break}
    const claimed=await claimNextNightFlightJob({supabase,runId:id,now,leaseMs:lease,maxAttempts:attemptsLimit,excludeJobKeys:attemptedJobKeys,onlyJobKey})
    if(!claimed) break
    attemptedJobKeys.add(clean(claimed.job_key))
    processed+=1

    let result
    let failure=null
    try{result=await processJob(claimed)}catch(error){failure=error}

    if(failure&&isProvider429(failure)){
      if(isProviderQuota429(failure)){
        await failNightFlightJob({supabase,claimedJob:claimed,error:failure,maxAttempts:attemptsLimit,now})
        stopReason='PROVIDER_QUOTA'
        break
      }
      const delay=retryDelayMs(failure)
      if(remaining()<=delay+reserve){
        await failNightFlightJob({supabase,claimedJob:claimed,error:failure,maxAttempts:attemptsLimit,now})
        stopReason='RATE_LIMIT_TIME_BUDGET'
        break
      }
      await sleep(delay)
      try{
        result=await processJob(claimed)
        failure=null
      }catch(retryError){
        await failNightFlightJob({supabase,claimedJob:claimed,error:retryError,maxAttempts:attemptsLimit,now})
        if(isProvider429(retryError)){
          stopReason=isProviderQuota429(retryError)?'PROVIDER_QUOTA':'RATE_LIMIT_REPEAT'
          break
        }
        continue
      }
    }

    if(failure){
      await failNightFlightJob({supabase,claimedJob:claimed,error:failure,maxAttempts:attemptsLimit,now})
      continue
    }
    await completeNightFlightJob({supabase,claimedJob:claimed,matchCacheKey:result?.matchCacheKey,now})
  }

  const reconciled=await reconcileNightFlightRun({supabase,runId:id,now})
  return {...reconciled,jobsProcessedThisInvocation:processed,stopReason}
}
