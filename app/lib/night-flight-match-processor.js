import {processNightFlightQueue} from './night-flight-match-queue.js'
import {getOrCreateExpertiseMatch,logicalExpertiseJobKey} from './expertise-match-server-cache.js'

const RUN_FIELDS='id,user_id,profile_fingerprint,cv_text_snapshot,cv_source_version'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight Match processor requires Supabase')
}

export async function processNightFlightRunMatches({
  supabase,
  userId,
  runId,
  processQueue=processNightFlightQueue,
  matchService=getOrCreateExpertiseMatch,
}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const id=clean(runId)
  if(!user||!id) throw new Error('Night Flight Match processor requires userId and runId')
  if(typeof processQueue!=='function'||typeof matchService!=='function') throw new Error('Night Flight Match processor dependencies are invalid')

  const {data:run,error}=await supabase
    .from('night_flight_runs')
    .select(RUN_FIELDS)
    .eq('id',id)
    .eq('user_id',user)
    .maybeSingle()
  if(error) throw new Error(`Night Flight run read failed: ${error.message||'unknown Supabase error'}`)
  if(!run?.id) throw new Error('Night Flight run is not available')

  const profileFingerprint=clean(run.profile_fingerprint)
  const cvText=String(run.cv_text_snapshot??'').trim()
  if(!profileFingerprint||cvText.length<40) throw new Error('Night Flight run Match snapshot is not available')

  return processQueue({
    supabase,
    runId:id,
    processJob:async claimedJob=>{
      const snapshot=claimedJob?.job_snapshot&&typeof claimedJob.job_snapshot==='object'?claimedJob.job_snapshot:{}
      const job={
        ...snapshot,
        description:clean(snapshot.description||snapshot.fullJd),
      }
      const logicalJobKey=logicalExpertiseJobKey(job,claimedJob?.job_key)
      const result=await matchService({
        supabase,
        userId:user,
        job,
        logicalJobKey,
        profileFingerprint,
        cvText,
      })
      return {matchCacheKey:result.matchCacheKey}
    },
  })
}
