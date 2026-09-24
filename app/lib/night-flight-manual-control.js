import {runNightFlightForUser} from './night-flight-scheduler.js'
import {processNightFlightRunMatches} from './night-flight-match-processor.js'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean=value=>String(value??'').trim()

export class ManualNightFlightError extends Error{
  constructor(message,status=400){super(message);this.name='ManualNightFlightError';this.status=status}
}

function requireInputs({supabase,userId}){
  if(!supabase||typeof supabase.from!=='function') throw new ManualNightFlightError('Supabase unavailable',500)
  if(!clean(userId)) throw new ManualNightFlightError('Authentication required',401)
}

function requireRunId(id){
  if(typeof id!=='string'||!UUID.test(id)) throw new ManualNightFlightError('Invalid run ID')
  return id
}

async function ownedRun(supabase,userId,runId){
  const id=requireRunId(runId)
  const {data,error}=await supabase.from('night_flight_runs')
    .select('id,target_date,status').eq('id',id).eq('user_id',userId).maybeSingle()
  if(error) throw new ManualNightFlightError('Could not read Night Flight run',500)
  if(!data?.id) throw new ManualNightFlightError('Night Flight run not found',404)
  return data
}

export async function listManualNightFlights({supabase,userId}={}){
  requireInputs({supabase,userId})
  const {data:runs,error:runError}=await supabase.from('night_flight_runs')
    .select('id,target_date,status,jobs_discovered,jobs_ready,jobs_failed,jobs_skipped,updated_at')
    .eq('user_id',userId).order('target_date',{ascending:false}).limit(15)
  if(runError) throw new ManualNightFlightError('Could not read Night Flight runs',500)
  const safeRuns=Array.isArray(runs)?runs:[]
  if(!safeRuns.length) return {runs:[]}
  const {data:jobs,error:jobError}=await supabase.from('night_flight_jobs')
    .select('run_id,job_key,status,attempts,last_error,job_snapshot')
    .in('run_id',safeRuns.map(run=>run.id))
  if(jobError) throw new ManualNightFlightError('Could not read Night Flight jobs',500)
  const byRun=new Map(safeRuns.map(run=>[run.id,[]]))
  for(const job of Array.isArray(jobs)?jobs:[]){
    if(!byRun.has(job.run_id)) continue
    byRun.get(job.run_id).push({
      jobKey:job.job_key,
      status:job.status,
      attempts:job.attempts,
      lastError:job.last_error,
      title:clean(job.job_snapshot?.title).slice(0,160),
      company:clean(job.job_snapshot?.company).slice(0,160),
    })
  }
  return {runs:safeRuns.map(({id,target_date,status,jobs_discovered,jobs_ready,jobs_failed,jobs_skipped,updated_at})=>({
    id,targetDate:target_date,status,jobsDiscovered:jobs_discovered,jobsReady:jobs_ready,
    jobsFailed:jobs_failed,jobsSkipped:jobs_skipped,updatedAt:updated_at,jobs:byRun.get(id),
  }))}
}

export async function executeManualNightFlight({
  supabase,userId,mode,runId,jobKey,now=new Date(),
  startRun=runNightFlightForUser,processMatches=processNightFlightRunMatches,
}={}){
  requireInputs({supabase,userId})
  if(mode==='start'){
    // Deliberately invoke the existing per-user runner, not the time-gated scheduler.
    // It resumes today's existing target run instead of duplicating discovery.
    const result=await startRun({supabase,userId,now})
    return {mode,runId:result.runId,targetDate:result.targetDate,resumed:result.resumed,status:result.status,
      jobsReady:result.jobsReady,jobsFailed:result.jobsFailed,unfinished:result.unfinished}
  }
  if(mode!=='resume'&&mode!=='retry') throw new ManualNightFlightError('Unknown manual Night Flight mode')
  const run=await ownedRun(supabase,userId,runId)
  if(mode==='resume'){
    const result=await processMatches({supabase,userId,runId:run.id})
    return {mode,runId:run.id,targetDate:run.target_date,status:result.status,
      jobsReady:result.jobsReady,jobsFailed:result.jobsFailed,unfinished:result.unfinished}
  }

  if(typeof jobKey!=='string'||!jobKey.trim()||jobKey.length>256) throw new ManualNightFlightError('Invalid job key')
  const {data:job,error:jobError}=await supabase.from('night_flight_jobs')
    .select('job_key,status,attempts,updated_at')
    .eq('run_id',run.id).eq('job_key',jobKey).maybeSingle()
  if(jobError) throw new ManualNightFlightError('Could not read selected job',500)
  if(!job) throw new ManualNightFlightError('Job not found in selected run',404)
  if(job.status!=='FAILED') throw new ManualNightFlightError('Only a FAILED job can be retried',409)
  // CAS: never overwrite a concurrently claimed or otherwise modified job.
  const {data:reset,error:resetError}=await supabase.from('night_flight_jobs')
    .update({status:'QUEUED',attempts:0,last_error:null,processed_at:null,match_cache_key:null,updated_at:new Date(now).toISOString()})
    .eq('run_id',run.id).eq('job_key',jobKey).eq('status','FAILED').eq('updated_at',job.updated_at)
    .select('job_key').maybeSingle()
  if(resetError) throw new ManualNightFlightError('Could not reset selected job',500)
  if(!reset) throw new ManualNightFlightError('Job changed concurrently; refresh before retry',409)
  const result=await processMatches({supabase,userId,runId:run.id,onlyJobKey:jobKey})
  return {mode,runId:run.id,targetDate:run.target_date,jobKey,status:result.status,
    jobsReady:result.jobsReady,jobsFailed:result.jobsFailed,unfinished:result.unfinished}
}
