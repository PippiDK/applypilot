import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {runNightFlightLastCompletedDayDiscovery} from '../../../lib/night-flight-last-completed-day.js'
import {persistNightFlightAreaScope} from '../../../lib/night-flight-area-scope.js'
import {processNightFlightRunMatches} from '../../../lib/night-flight-match-processor.js'
import {processNightFlightQueue} from '../../../lib/night-flight-match-queue.js'
import {runNightFlightForUser} from '../../../lib/night-flight-scheduler.js'
import {getOrCreateExpertiseMatch,resolveManualExpertiseMatch} from '../../../lib/expertise-match-server-cache.js'
import {recoverFailedNightFlightMatch} from '../../../lib/night-flight-manual-recovery.js'
import {createNoStoreFetch} from '../../../lib/supabase/no-store-fetch.js'

export const dynamic='force-dynamic'
export const maxDuration=300

const TEST_URL='https://tafdswfdblxoehreaalm.supabase.co'
const TEST_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZmRzd2ZkYmx4b2VocmVhYWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTYyODksImV4cCI6MjEwNDIzMjI4OX0.SI-N9Yr6t7N9VkAclQFBH8NkJtBv7aOrNVetpMpIjtA'
const USER_ID='14141414-1414-4141-8141-141414141414'
const FORCED_NOW=new Date('2026-09-05T10:00:00.000Z')
const TARGET_DATE='2026-09-04'
const CONFIRM='TASK14_ACCEPTANCE'
const ACTIONS=new Set(['crash','resume-fail','recover','repeat'])

const clean=value=>String(value??'').trim()

function allowed(){
  return process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_GIT_COMMIT_REF === 'v18/night-flight-task14-test-forced-day'
}

function testSupabase(){
  return createClient(TEST_URL,TEST_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:createNoStoreFetch()},
  })
}

async function readRun(supabase){
  const {data,error}=await supabase
    .from('night_flight_runs')
    .select('*')
    .eq('user_id',USER_ID)
    .eq('target_date',TARGET_DATE)
    .maybeSingle()
  if(error) throw new Error(`Task 14 run read failed: ${error.message}`)
  return data||null
}

async function readJobs(supabase,runId){
  if(!runId) return []
  const {data,error}=await supabase
    .from('night_flight_jobs')
    .select('*')
    .eq('run_id',runId)
    .order('created_at',{ascending:true})
  if(error) throw new Error(`Task 14 jobs read failed: ${error.message}`)
  return Array.isArray(data)?data:[]
}

async function readCacheCount(supabase){
  const {count,error}=await supabase
    .from('expertise_match_cache')
    .select('cache_key',{count:'exact',head:true})
    .eq('user_id',USER_ID)
  if(error) throw new Error(`Task 14 cache count failed: ${error.message}`)
  return Number(count||0)
}

function jobMetrics(jobs=[]){
  const count=status=>jobs.filter(job=>job.status===status).length
  return {
    discovered:jobs.length,
    insideAreas:jobs.length-count('SKIPPED_AREA'),
    skippedByArea:count('SKIPPED_AREA'),
    ready:count('READY'),
    failed:count('FAILED'),
    queued:count('QUEUED'),
    retry:count('RETRY'),
    processing:count('PROCESSING'),
    retries:jobs.reduce((sum,job)=>sum+Math.max(0,Number(job.attempts||0)-1),0),
  }
}

async function state(supabase){
  const run=await readRun(supabase)
  const jobs=await readJobs(supabase,run?.id)
  return {
    run:run?{
      id:run.id,
      targetDate:run.target_date,
      status:run.status,
      sources:run.sources,
      areas:run.areas,
      jobsDiscovered:run.jobs_discovered,
      jobsQueued:run.jobs_queued,
      jobsReady:run.jobs_ready,
      jobsFailed:run.jobs_failed,
      jobsSkipped:run.jobs_skipped,
    }:null,
    metrics:jobMetrics(jobs),
    cacheEntries:await readCacheCount(supabase),
    jobs,
  }
}

function publicState(value){
  return {
    run:value.run,
    metrics:value.metrics,
    cacheEntries:value.cacheEntries,
  }
}

async function crashPhase(supabase){
  if(await readRun(supabase)) throw new Error('Task 14 forced-day run already exists')
  const started=Date.now()
  const batch=await runNightFlightLastCompletedDayDiscovery({
    supabase,
    userId:USER_ID,
    now:FORCED_NOW,
  })
  if(clean(batch.targetDate)!==TARGET_DATE) throw new Error(`Task 14 target day mismatch: ${batch.targetDate}`)
  const sourceCounts=Object.fromEntries((batch.sourceResults||[]).map(result=>[
    clean(result.source),
    Array.isArray(result.jobs)?result.jobs.length:0,
  ]))
  const persisted=await persistNightFlightAreaScope({supabase,userId:USER_ID,batch})
  await processNightFlightRunMatches({
    supabase,
    userId:USER_ID,
    runId:persisted.runId,
    processQueue:options=>processNightFlightQueue({...options,maxJobs:1}),
  })
  const after=await state(supabase)
  return {
    phase:'crash',
    forcedNow:FORCED_NOW.toISOString(),
    targetDate:batch.targetDate,
    sourcesSelected:batch.sourcesSnapshot,
    sourceCounts,
    ...publicState(after),
    simulatedStop:after.metrics.queued+after.metrics.retry>0,
    elapsedMs:Date.now()-started,
  }
}

async function resumeFailPhase(supabase){
  const before=await state(supabase)
  if(!before.run?.id) throw new Error('Task 14 crash phase must run first')
  const readyBefore=new Map(before.jobs.filter(job=>job.status==='READY').map(job=>[
    job.job_key,
    `${clean(job.match_cache_key)}|${clean(job.processed_at)}`,
  ]))
  let forcedLogicalKey=''
  const started=Date.now()
  await processNightFlightRunMatches({
    supabase,
    userId:USER_ID,
    runId:before.run.id,
    matchService:async options=>{
      if(!forcedLogicalKey) forcedLogicalKey=clean(options.logicalJobKey)
      if(clean(options.logicalJobKey)===forcedLogicalKey){
        throw new Error('TASK14 forced Match failure')
      }
      return getOrCreateExpertiseMatch(options)
    },
    processQueue:options=>processNightFlightQueue({...options,maxJobs:3}),
  })
  const after=await state(supabase)
  const failed=after.jobs.find(job=>job.status==='FAILED'&&clean(job.last_error).includes('TASK14'))||null
  const readyPreserved=[...readyBefore.entries()].every(([key,snapshot])=>{
    const row=after.jobs.find(job=>job.job_key===key)
    return row?.status==='READY'&&`${clean(row.match_cache_key)}|${clean(row.processed_at)}`===snapshot
  })
  if(!failed) throw new Error('Task 14 forced failure did not reach FAILED')
  return {
    phase:'resume-fail',
    ...publicState(after),
    forcedFailure:{jobKey:failed.job_key,attempts:failed.attempts,lastError:failed.last_error},
    readyPreserved,
    elapsedMs:Date.now()-started,
  }
}

async function recoverPhase(supabase){
  const before=await state(supabase)
  const failed=before.jobs.find(job=>job.status==='FAILED')
  if(!before.run?.id||!failed) throw new Error('Task 14 requires a FAILED job before recovery')
  const started=Date.now()
  const recovery=await recoverFailedNightFlightMatch({
    supabase,
    userId:USER_ID,
    runId:before.run.id,
    jobKey:failed.job_key,
  })
  const after=await state(supabase)
  return {
    phase:'recover',
    ...publicState(after),
    recovery:{
      jobKey:failed.job_key,
      status:after.jobs.find(job=>job.job_key===failed.job_key)?.status||null,
      cacheHit:Boolean(recovery.cacheHit),
      matchCacheKey:recovery.matchCacheKey,
    },
    elapsedMs:Date.now()-started,
  }
}

function stableReadySnapshot(jobs=[]){
  return jobs
    .filter(job=>job.status==='READY')
    .map(job=>[job.job_key,clean(job.match_cache_key),clean(job.processed_at)])
    .sort((a,b)=>a[0].localeCompare(b[0]))
}

async function repeatPhase(supabase){
  const started=Date.now()
  const before=await state(supabase)
  if(!before.run?.id) throw new Error('Task 14 run is unavailable')

  await runNightFlightForUser({supabase,userId:USER_ID,now:FORCED_NOW})
  const completed=await state(supabase)
  if(!['READY','READY_WITH_ERRORS','NO_JOBS'].includes(completed.run?.status)){
    throw new Error(`Task 14 run did not reach terminal state: ${completed.run?.status}`)
  }

  const {data:runRow,error:runError}=await supabase
    .from('night_flight_runs')
    .select('id,profile_fingerprint,cv_text_snapshot,cv_source_version')
    .eq('id',completed.run.id)
    .single()
  if(runError) throw new Error(`Task 14 run snapshot read failed: ${runError.message}`)

  const manualJob=completed.jobs.find(job=>{
    const snapshot=job.job_snapshot||{}
    return job.status==='READY'&&clean(job.match_cache_key)&&clean(snapshot.title)&&clean(snapshot.company)
  })
  if(!manualJob) throw new Error('Task 14 has no READY job for manual cache reuse')

  let manualAnalyzeCalls=0
  const manual=await resolveManualExpertiseMatch({
    supabase,
    userId:USER_ID,
    job:manualJob.job_snapshot||{},
    cvText:runRow.cv_text_snapshot,
    cvSourceVersion:runRow.cv_source_version,
    profileState:{
      cv_text:runRow.cv_text_snapshot,
      cv_source_version:runRow.cv_source_version,
      profile_fingerprint:runRow.profile_fingerprint,
    },
    analyze:async()=>{
      manualAnalyzeCalls+=1
      throw new Error('TASK14 duplicate manual AI call')
    },
  })

  const terminalSnapshot=stableReadySnapshot(completed.jobs)
  const terminalCacheCount=completed.cacheEntries
  let duplicateMatchCalls=0
  const repeated=await runNightFlightForUser({
    supabase,
    userId:USER_ID,
    now:FORCED_NOW,
    processMatches:options=>processNightFlightRunMatches({
      ...options,
      matchService:async()=>{
        duplicateMatchCalls+=1
        throw new Error('TASK14 duplicate Night Flight AI call')
      },
    }),
  })
  const after=await state(supabase)

  return {
    phase:'repeat',
    ...publicState(after),
    completedBeforeRepeat:publicState(completed),
    idempotency:{
      resumed:Boolean(repeated.resumed),
      sameRunId:completed.run.id===after.run?.id,
      sameJobCount:completed.metrics.discovered===after.metrics.discovered,
      readyRowsUnchanged:JSON.stringify(terminalSnapshot)===JSON.stringify(stableReadySnapshot(after.jobs)),
      cacheCountUnchanged:terminalCacheCount===after.cacheEntries,
      duplicateMatchCalls,
    },
    manualCacheReuse:{
      jobKey:manualJob.job_key,
      cacheHit:Boolean(manual.cacheHit),
      sameCacheKey:clean(manual.matchCacheKey)===clean(manualJob.match_cache_key),
      analyzeCalls:manualAnalyzeCalls,
    },
    elapsedMs:Date.now()-started,
  }
}

export async function GET(request){
  if(!allowed()) return NextResponse.json({error:'Not found'},{status:404})
  const url=new URL(request.url)
  if(url.searchParams.get('confirm')!==CONFIRM){
    return NextResponse.json({error:'Task 14 confirmation required'},{status:403})
  }
  const action=clean(url.searchParams.get('action'))
  if(!ACTIONS.has(action)) return NextResponse.json({error:'Unknown Task 14 action'},{status:400})

  try{
    const supabase=testSupabase()
    const result=action==='crash'
      ?await crashPhase(supabase)
      :action==='resume-fail'
        ?await resumeFailPhase(supabase)
        :action==='recover'
          ?await recoverPhase(supabase)
          :await repeatPhase(supabase)
    return NextResponse.json(result)
  }catch(error){
    console.error('[task14-acceptance]',action,clean(error?.message||error))
    return NextResponse.json({error:clean(error?.message||error)||'Task 14 acceptance failed',action},{status:500})
  }
}
