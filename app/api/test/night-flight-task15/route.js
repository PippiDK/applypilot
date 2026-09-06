import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {runNightFlightScheduler} from '../../../lib/night-flight-scheduler.js'
import {lastCompletedCopenhagenDate} from '../../../lib/night-flight-last-completed-day.js'
import {createNoStoreFetch} from '../../../lib/supabase/no-store-fetch.js'

export const dynamic='force-dynamic'
export const maxDuration=300

const TEST_URL='https://tafdswfdblxoehreaalm.supabase.co'
const TEST_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZmRzd2ZkYmx4b2VocmVhYWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTYyODksImV4cCI6MjEwNDIzMjI4OX0.SI-N9Yr6t7N9VkAclQFBH8NkJtBv7aOrNVetpMpIjtA'
const USER_ID='14141414-1414-4141-8141-141414141414'
const CONFIRM='TASK15_OVERNIGHT'
const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'
const ACTIONS=new Set(['run','verify'])

const clean=value=>String(value??'').trim()

function allowed(){
  return process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_GIT_COMMIT_REF === 'v18/night-flight-task15-overnight-test'
}

function testSupabase(){
  return createClient(TEST_URL,TEST_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:createNoStoreFetch()},
  })
}

function copenhagenClock(now){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:COPENHAGEN_TIME_ZONE,
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',
    hourCycle:'h23',
  }).formatToParts(now)
  const value=type=>parts.find(part=>part.type===type)?.value||''
  return {
    date:`${value('year')}-${value('month')}-${value('day')}`,
    hour:Number(value('hour')),
    minute:Number(value('minute')),
    second:Number(value('second')),
    text:`${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')} Europe/Copenhagen`,
  }
}

async function readMorningState(supabase,now=new Date()){
  const targetDate=lastCompletedCopenhagenDate(now)
  const {data:run,error:runError}=await supabase
    .from('night_flight_runs')
    .select('*')
    .eq('user_id',USER_ID)
    .eq('target_date',targetDate)
    .maybeSingle()
  if(runError) throw new Error(`Task 15 run read failed: ${runError.message}`)

  let jobs=[]
  if(run?.id){
    const {data,error}=await supabase
      .from('night_flight_jobs')
      .select('*')
      .eq('run_id',run.id)
      .order('created_at',{ascending:true})
    if(error) throw new Error(`Task 15 jobs read failed: ${error.message}`)
    jobs=Array.isArray(data)?data:[]
  }

  const readyJob=jobs.find(job=>job.status==='READY'&&clean(job.match_cache_key))||null
  let cache=null
  if(readyJob){
    const {data,error}=await supabase
      .from('expertise_match_cache')
      .select('cache_key,logical_job_key,profile_fingerprint,engine_version,analysis,created_at,updated_at')
      .eq('user_id',USER_ID)
      .eq('cache_key',readyJob.match_cache_key)
      .maybeSingle()
    if(error) throw new Error(`Task 15 cache read failed: ${error.message}`)
    cache=data||null
  }

  const count=status=>jobs.filter(job=>job.status===status).length
  const matchAlreadyLoaded=Boolean(readyJob&&cache?.analysis)
  return {
    targetDate,
    run:run?{
      id:run.id,
      status:run.status,
      startedAt:run.started_at,
      completedAt:run.completed_at,
      jobsDiscovered:run.jobs_discovered,
      jobsReady:run.jobs_ready,
      jobsFailed:run.jobs_failed,
      jobsSkipped:run.jobs_skipped,
    }:null,
    metrics:{
      discovered:jobs.length,
      ready:count('READY'),
      failed:count('FAILED'),
      skippedArea:count('SKIPPED_AREA'),
      queued:count('QUEUED'),
      retry:count('RETRY'),
      processing:count('PROCESSING'),
    },
    sampleReadyJob:readyJob?{
      jobKey:readyJob.job_key,
      source:readyJob.source,
      cacheKey:readyJob.match_cache_key,
      processedAt:readyJob.processed_at,
    }:null,
    cachedMatch:cache?{
      cacheKey:cache.cache_key,
      logicalJobKey:cache.logical_job_key,
      profileFingerprint:cache.profile_fingerprint,
      engineVersion:cache.engine_version,
      createdAt:cache.created_at,
      updatedAt:cache.updated_at,
    }:null,
    matchAlreadyLoaded,
  }
}

export async function GET(request){
  if(!allowed()) return NextResponse.json({error:'Not found'},{status:404})
  const url=new URL(request.url)
  if(url.searchParams.get('confirm')!==CONFIRM){
    return NextResponse.json({error:'Task 15 confirmation required'},{status:403})
  }
  const action=clean(url.searchParams.get('action'))
  if(!ACTIONS.has(action)) return NextResponse.json({error:'Unknown Task 15 action'},{status:400})

  try{
    const now=new Date()
    const clock=copenhagenClock(now)
    const supabase=testSupabase()

    if(action==='verify'){
      return NextResponse.json({
        phase:'verify',
        checkedAt:now.toISOString(),
        copenhagenTime:clock.text,
        ...(await readMorningState(supabase,now)),
      })
    }

    if(clock.hour!==2){
      return NextResponse.json({
        error:'Task 15 run is allowed only during the real 02:00 Copenhagen hour',
        copenhagenTime:clock.text,
      },{status:409})
    }

    const scheduler=await runNightFlightScheduler({supabase,now})
    const state=await readMorningState(supabase,now)
    return NextResponse.json({
      phase:'run',
      triggeredAt:now.toISOString(),
      copenhagenTime:clock.text,
      scheduler,
      ...state,
    })
  }catch(error){
    console.error('[task15-overnight]',clean(error?.message||error))
    return NextResponse.json({error:clean(error?.message||error)||'Task 15 overnight acceptance failed'},{status:500})
  }
}
