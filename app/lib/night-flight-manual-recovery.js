import {getOrCreateExpertiseMatch,logicalExpertiseJobKey} from './expertise-match-server-cache.js'
import {reconcileNightFlightRun} from './night-flight-match-queue.js'

const RUN_FIELDS='id,user_id,profile_fingerprint,cv_text_snapshot,cv_source_version'
const JOB_FIELDS='run_id,job_key,source,job_snapshot,status,last_error,match_cache_key,processed_at,updated_at'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight manual recovery requires Supabase')
}

export async function recoverFailedNightFlightMatch({
  supabase,
  userId,
  runId,
  jobKey,
  matchService=getOrCreateExpertiseMatch,
  reconcile=reconcileNightFlightRun,
  now=new Date(),
}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const id=clean(runId)
  const key=clean(jobKey)
  if(!user||!id||!key) throw new Error('Night Flight manual recovery requires userId, runId and jobKey')
  if(typeof matchService!=='function'||typeof reconcile!=='function') throw new Error('Night Flight manual recovery dependencies are invalid')

  const {data:run,error:runError}=await supabase
    .from('night_flight_runs')
    .select(RUN_FIELDS)
    .eq('id',id)
    .eq('user_id',user)
    .maybeSingle()
  if(runError) throw new Error(`Night Flight recovery run read failed: ${runError.message||'unknown Supabase error'}`)
  if(!run?.id) throw new Error('Night Flight run is not available for manual recovery')

  const {data:row,error:jobError}=await supabase
    .from('night_flight_jobs')
    .select(JOB_FIELDS)
    .eq('run_id',id)
    .eq('job_key',key)
    .maybeSingle()
  if(jobError) throw new Error(`Night Flight recovery job read failed: ${jobError.message||'unknown Supabase error'}`)
  if(!row?.job_key) throw new Error('Night Flight job is not available for manual recovery')
  if(row.status!=='FAILED') throw new Error('Night Flight manual recovery is available only for FAILED jobs')

  const profileFingerprint=clean(run.profile_fingerprint)
  const cvText=String(run.cv_text_snapshot??'').trim()
  if(!profileFingerprint||cvText.length<40) throw new Error('Night Flight run Match snapshot is not available')

  const snapshot=row.job_snapshot&&typeof row.job_snapshot==='object'?row.job_snapshot:{}
  const job={
    ...snapshot,
    description:clean(snapshot.description||snapshot.fullJd),
  }
  const logicalJobKey=logicalExpertiseJobKey(job,key)
  const result=await matchService({
    supabase,
    userId:user,
    job,
    logicalJobKey,
    profileFingerprint,
    cvText,
  })
  const matchCacheKey=clean(result?.matchCacheKey)
  if(!matchCacheKey) throw new Error('Night Flight manual recovery did not produce a Match cache key')

  const date=now instanceof Date?now:new Date(now)
  if(!Number.isFinite(date.getTime())) throw new Error('Night Flight manual recovery time is invalid')
  const stamp=date.toISOString()
  const {data:ready,error:updateError}=await supabase
    .from('night_flight_jobs')
    .update({
      status:'READY',
      match_cache_key:matchCacheKey,
      last_error:null,
      processed_at:stamp,
      updated_at:stamp,
    })
    .eq('run_id',id)
    .eq('job_key',key)
    .eq('status','FAILED')
    .select(JOB_FIELDS)
    .maybeSingle()
  if(updateError) throw new Error(`Night Flight recovery update failed: ${updateError.message||'unknown Supabase error'}`)
  if(!ready?.job_key) throw new Error('Night Flight job is no longer FAILED')

  const runState=await reconcile({supabase,runId:id,now:date})
  return {job:ready,run:runState,analysis:result.analysis,matchCacheKey,cacheHit:Boolean(result.cacheHit)}
}
