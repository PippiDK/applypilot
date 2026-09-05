import {lastCompletedCopenhagenDate,runNightFlightLastCompletedDayDiscovery} from './night-flight-last-completed-day.js'
import {persistNightFlightAreaScope} from './night-flight-area-scope.js'
import {processNightFlightRunMatches} from './night-flight-match-processor.js'

const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'

const clean=value=>String(value??'').trim()

function resolveNow(now){
  const value=now instanceof Date?now:new Date(now??Date.now())
  if(!Number.isFinite(value.getTime())) throw new Error('Night Flight scheduler time is invalid')
  return value
}

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight scheduler requires Supabase')
}

function copenhagenHour(now){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:COPENHAGEN_TIME_ZONE,
    hour:'2-digit',
    hourCycle:'h23',
  }).formatToParts(resolveNow(now))
  return Number(parts.find(part=>part.type==='hour')?.value)
}

export function shouldRunNightFlightTick(now=new Date()){
  const hour=copenhagenHour(now)
  return Number.isFinite(hour)&&hour>=2
}

export async function runNightFlightForUser({
  supabase,
  userId,
  now=new Date(),
  discover=runNightFlightLastCompletedDayDiscovery,
  persist=persistNightFlightAreaScope,
  processMatches=processNightFlightRunMatches,
}={}){
  requireSupabase(supabase)
  const id=clean(userId)
  if(!id) throw new Error('Night Flight scheduler requires userId')
  const current=resolveNow(now)
  const targetDate=lastCompletedCopenhagenDate(current)

  const {data:existing,error:existingError}=await supabase
    .from('night_flight_runs')
    .select('id,status,target_date')
    .eq('user_id',id)
    .eq('target_date',targetDate)
    .maybeSingle()

  if(existingError) throw new Error(`Night Flight run lookup failed: ${existingError.message||'unknown Supabase error'}`)
  if(existing?.id){
    const processed=await processMatches({supabase,userId:id,runId:existing.id})
    return {
      ...processed,
      runId:existing.id,
      targetDate,
      resumed:true,
    }
  }

  const batch=await discover({supabase,userId:id,now:current})
  if(clean(batch?.targetDate)!==targetDate) throw new Error('Night Flight discovery target date mismatch')
  const persisted=await persist({supabase,userId:id,batch})
  if(!clean(persisted?.runId)) throw new Error('Night Flight persisted run is unavailable')
  const processed=await processMatches({supabase,userId:id,runId:persisted.runId})

  return {
    ...persisted,
    ...processed,
    runId:persisted.runId,
    targetDate,
    resumed:false,
  }
}

function safeErrorMessage(error){
  return (clean(error?.message||error||'Night Flight user run failed')||'Night Flight user run failed').slice(0,300)
}

export async function runNightFlightScheduler({
  supabase,
  now=new Date(),
  runUser=runNightFlightForUser,
}={}){
  requireSupabase(supabase)
  const current=resolveNow(now)
  if(!shouldRunNightFlightTick(current)){
    return {
      skipped:true,
      usersEligible:0,
      usersSucceeded:0,
      usersFailed:0,
      results:[],
      failures:[],
    }
  }

  const {data,error}=await supabase
    .from('night_flight_settings')
    .select('user_id')
    .eq('enabled',true)

  if(error) throw new Error(`Night Flight enabled-user read failed: ${error.message||'unknown Supabase error'}`)

  const userIds=[...new Set((Array.isArray(data)?data:[]).map(row=>clean(row?.user_id)).filter(Boolean))]
  const results=[]
  const failures=[]

  for(const userId of userIds){
    try{
      const result=await runUser({supabase,userId,now:current})
      results.push({userId,...(result||{})})
    }catch(error){
      failures.push({userId,error:safeErrorMessage(error)})
    }
  }

  return {
    skipped:false,
    usersEligible:userIds.length,
    usersSucceeded:userIds.length-failures.length,
    usersFailed:failures.length,
    results,
    failures,
  }
}
