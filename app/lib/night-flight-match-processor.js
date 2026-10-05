import {
  processNightFlightQueue,
  claimNextNightFlightJob,
  completeNightFlightJob,
  failNightFlightJob,
  reconcileNightFlightRun,
} from './night-flight-match-queue.js'
import {
  getOrCreateExpertiseMatch,
  logicalExpertiseJobKey,
  readExpertiseMatchCache,
  storeExpertiseMatchCache,
} from './expertise-match-server-cache.js'
import {
  analyzeExpertiseBatch,
  packExpertiseBatchJobs,
  DEFAULT_EXPERTISE_BATCH_MAX_JOBS,
} from './expertise-batch.js'
import {reconcileNightFlightAppliedHistory} from './night-flight-applied-history.js'

const RUN_FIELDS='id,user_id,profile_fingerprint,cv_text_snapshot,cv_source_version'
const FINAL_RUN_STATUSES=new Set(['READY','READY_WITH_ERRORS','NO_JOBS','FAILED'])
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight Match processor requires Supabase')
}

function snapshotJob(claimedJob){
  const snapshot=claimedJob?.job_snapshot&&typeof claimedJob.job_snapshot==='object'?claimedJob.job_snapshot:{}
  return {...snapshot,description:clean(snapshot.description||snapshot.fullJd)}
}

function providerFailure(error){
  return /^AI_PROVIDER_/.test(clean(error?.code))
}

async function legacySingleJobPath({
  supabase,user,runId,profileFingerprint,cvText,onlyJobKey,processQueue,matchService,
}){
  return processQueue({
    supabase,
    runId,
    maxJobs:onlyJobKey?1:Infinity,
    onlyJobKey,
    processJob:async claimedJob=>{
      const job=snapshotJob(claimedJob)
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

async function processFrozenRunInAiBatches({
  supabase,
  user,
  runId,
  profileFingerprint,
  cvText,
  claimJob=claimNextNightFlightJob,
  completeJob=completeNightFlightJob,
  failJob=failNightFlightJob,
  reconcileRun=reconcileNightFlightRun,
  readCache=readExpertiseMatchCache,
  storeCache=storeExpertiseMatchCache,
  batchAnalyze=analyzeExpertiseBatch,
  packBatches=packExpertiseBatchJobs,
  batchMaxJobs=DEFAULT_EXPERTISE_BATCH_MAX_JOBS,
}){
  const attemptedJobKeys=new Set()
  let claimedCount=0
  let cacheHits=0
  let aiBatchCalls=0
  let stopReason=null
  let drained=false

  while(!drained&&!stopReason){
    const misses=[]

    while(misses.length<batchMaxJobs){
      const claimed=await claimJob({
        supabase,
        runId,
        excludeJobKeys:attemptedJobKeys,
      })
      if(!claimed){
        drained=true
        break
      }

      const jobKey=clean(claimed.job_key)
      attemptedJobKeys.add(jobKey)
      claimedCount+=1
      const job=snapshotJob(claimed)
      const logicalJobKey=logicalExpertiseJobKey(job,jobKey)

      try{
        const cached=await readCache({
          supabase,
          userId:user,
          logicalJobKey,
          profileFingerprint,
        })
        if(cached.cacheHit){
          await completeJob({
            supabase,
            claimedJob:claimed,
            matchCacheKey:cached.matchCacheKey,
          })
          cacheHits+=1
          continue
        }
        misses.push({claimed,jobKey,logicalJobKey,job})
      }catch(error){
        await failJob({supabase,claimedJob:claimed,error})
      }
    }

    if(!misses.length) continue

    const batches=packBatches(misses.map(item=>({jobKey:item.jobKey,job:item.job})))
    for(const batch of batches){
      const keys=new Set(batch.map(item=>item.jobKey))
      const batchMisses=misses.filter(item=>keys.has(item.jobKey))
      let outcome
      try{
        aiBatchCalls+=1
        outcome=await batchAnalyze({
          jobs:batch,
          cvText,
        })
      }catch(error){
        for(const item of batchMisses) await failJob({supabase,claimedJob:item.claimed,error})
        if(providerFailure(error)){
          stopReason=clean(error?.code)||'AI_PROVIDER_FAILURE'
          break
        }
        continue
      }

      const successes=new Map((outcome?.results||[]).map(item=>[clean(item.jobKey),item.analysis]))
      const failures=new Map((outcome?.failures||[]).map(item=>[clean(item.jobKey),item.error]))

      for(const item of batchMisses){
        const analysis=successes.get(item.jobKey)
        const failure=failures.get(item.jobKey)
        if(!analysis){
          const error=failure||new Error('Expertise Match batch response is missing a vacancy result.')
          if(!error.code) error.code='AI_EXPERTISE_VALIDATION'
          await failJob({supabase,claimedJob:item.claimed,error})
          continue
        }

        try{
          const stored=await storeCache({
            supabase,
            userId:user,
            logicalJobKey:item.logicalJobKey,
            profileFingerprint,
            analysis,
          })
          await completeJob({
            supabase,
            claimedJob:item.claimed,
            matchCacheKey:stored.matchCacheKey,
          })
        }catch(error){
          await failJob({supabase,claimedJob:item.claimed,error})
        }
      }
    }
  }

  const reconciled=await reconcileRun({supabase,runId})
  return {
    ...reconciled,
    jobsProcessedThisInvocation:claimedCount,
    cacheHitsThisInvocation:cacheHits,
    aiBatchCallsThisInvocation:aiBatchCalls,
    stopReason,
  }
}

export async function processNightFlightRunMatches({
  supabase,
  userId,
  runId,
  processQueue=processNightFlightQueue,
  matchService=getOrCreateExpertiseMatch,
  reconcileAppliedHistory=reconcileNightFlightAppliedHistory,
  onlyJobKey='',
  claimJob=claimNextNightFlightJob,
  completeJob=completeNightFlightJob,
  failJob=failNightFlightJob,
  reconcileRun=reconcileNightFlightRun,
  readCache=readExpertiseMatchCache,
  storeCache=storeExpertiseMatchCache,
  batchAnalyze=analyzeExpertiseBatch,
  packBatches=packExpertiseBatchJobs,
  batchMaxJobs=DEFAULT_EXPERTISE_BATCH_MAX_JOBS,
}={}){
  requireSupabase(supabase)
  const user=clean(userId)
  const id=clean(runId)
  if(!user||!id) throw new Error('Night Flight Match processor requires userId and runId')
  if(typeof reconcileAppliedHistory!=='function') throw new Error('Night Flight Match processor dependencies are invalid')

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

  // Targeted manual retry stays single-job. Normal Night Pilot uses one frozen-list batch path.
  const useLegacyPath=Boolean(onlyJobKey)||processQueue!==processNightFlightQueue
  const processed=useLegacyPath
    ?await legacySingleJobPath({
      supabase,user,runId:id,profileFingerprint,cvText,onlyJobKey,processQueue,matchService,
    })
    :await processFrozenRunInAiBatches({
      supabase,user,runId:id,profileFingerprint,cvText,
      claimJob,completeJob,failJob,reconcileRun,readCache,storeCache,batchAnalyze,packBatches,batchMaxJobs,
    })

  if(!FINAL_RUN_STATUSES.has(clean(processed?.status))) return processed

  try{
    const reconciliation=await reconcileAppliedHistory({supabase,userId:user,runId:id})
    return {
      ...processed,
      alreadyAppliedReconciled:true,
      alreadyAppliedCount:Number(reconciliation?.alreadyApplied||0),
    }
  }catch{
    return {...processed,alreadyAppliedReconciled:false}
  }
}
