import {processNightFlightRunMatches} from './night-flight-match-processor.js'

export const DEFAULT_NIGHT_FLIGHT_WORKER_RUN_SCAN_LIMIT=5

const clean=value=>String(value??'').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight worker requires Supabase')
}

function safeFailure(runId){
  return {runId:clean(runId),error:'Night Flight run could not be processed.'}
}

export async function runNightFlightWorker({
  supabase,
  processMatches=processNightFlightRunMatches,
  runScanLimit=DEFAULT_NIGHT_FLIGHT_WORKER_RUN_SCAN_LIMIT,
}={}){
  requireSupabase(supabase)
  if(typeof processMatches!=='function') throw new Error('Night Flight worker processor is invalid')
  const limit=Number.isInteger(Number(runScanLimit))&&Number(runScanLimit)>0?Number(runScanLimit):DEFAULT_NIGHT_FLIGHT_WORKER_RUN_SCAN_LIMIT

  const {data,error}=await supabase
    .from('night_flight_runs')
    .select('id,user_id,target_date,status,created_at')
    .eq('status','RUNNING')
    .order('target_date',{ascending:false})
    .order('created_at',{ascending:true})
    .limit(limit)

  if(error) throw new Error(`Night Flight worker run read failed: ${error.message||'unknown Supabase error'}`)
  const runs=Array.isArray(data)?data:[]

  let scanned=0
  const failures=[]
  for(const run of runs){
    const runId=clean(run?.id)
    const userId=clean(run?.user_id)
    if(!runId||!userId) continue
    scanned+=1
    try{
      const result=await processMatches({supabase,userId,runId})
      const processed=Number(result?.jobsProcessedThisInvocation||0)
      if(processed>0||clean(result?.status)!=='RUNNING'){
        return {
          idle:false,
          candidatesScanned:scanned,
          runId,
          targetDate:run?.target_date||null,
          jobsProcessedThisInvocation:processed,
          status:clean(result?.status)||'RUNNING',
          failures,
        }
      }
    }catch{
      failures.push(safeFailure(runId))
    }
  }

  return {idle:true,candidatesScanned:scanned,failures}
}
