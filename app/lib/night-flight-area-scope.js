import {classifySearchArea} from './job-list-filters.js'

const clean=value=>String(value??'').trim()

function requireBatch(batch){
  if(!batch||typeof batch!=='object') throw new Error('Night Flight discovery batch is required')
  if(!clean(batch.targetDate)) throw new Error('Night Flight target date is required')
  return batch
}

function sourceFor(item={}){
  const job=item?.job||item||{}
  return clean(job.source||item?.nightFlightSources?.[0]||job.sourceRecords?.[0]?.source).toLowerCase()
}

function jobKeyFor(item={},index=0){
  const job=item?.job||item||{}
  const source=sourceFor(item)
  const sourceJobId=clean(job.sourceJobId||job.sourceRecords?.[0]?.sourceJobId)
  return clean(job.jobId)||(source&&sourceJobId?`${source}:${sourceJobId}`:`night-flight-job-${index+1}`)
}

export function planNightFlightAreaScope(batch){
  const frozenBatch=requireBatch(batch)
  const selectedAreas=new Set(Array.isArray(frozenBatch.areasSnapshot)?frozenBatch.areasSnapshot:[])
  const matchAll=selectedAreas.size===0

  return (Array.isArray(frozenBatch.jobs)?frozenBatch.jobs:[]).map(item=>{
    const job=item?.job||item||{}
    const area=classifySearchArea(job)
    return {
      job:item,
      area:area||null,
      status:matchAll||Boolean(area&&selectedAreas.has(area))?'QUEUED':'SKIPPED_AREA',
    }
  })
}

export async function persistNightFlightAreaScope({supabase,userId,batch}={}){
  if(!userId) throw new Error('Authenticated user is required')
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
  const frozenBatch=requireBatch(batch)

  const {data:existingRun,error:existingRunError}=await supabase
    .from('night_flight_runs')
    .select('id,status,jobs_discovered,jobs_queued,jobs_skipped')
    .eq('user_id',userId)
    .eq('target_date',frozenBatch.targetDate)
    .maybeSingle()

  if(existingRunError) throw new Error(`Night Flight run lookup failed: ${existingRunError.message||'unknown Supabase error'}`)
  if(existingRun?.id){
    return {
      runId:existingRun.id,
      jobsDiscovered:Number(existingRun.jobs_discovered||0),
      jobsQueued:Number(existingRun.jobs_queued||0),
      jobsSkipped:Number(existingRun.jobs_skipped||0),
      status:existingRun.status||'RUNNING',
    }
  }

  const planned=planNightFlightAreaScope(frozenBatch)
  const jobsQueued=planned.filter(row=>row.status==='QUEUED').length
  const jobsSkipped=planned.length-jobsQueued

  const runPayload={
    user_id:userId,
    target_date:frozenBatch.targetDate,
    profile_fingerprint:clean(frozenBatch.profileFingerprint),
    search_profile_snapshot:frozenBatch.searchProfileSnapshot&&typeof frozenBatch.searchProfileSnapshot==='object'?frozenBatch.searchProfileSnapshot:{},
    cv_source_version:clean(frozenBatch.cvSourceVersion),
    cv_text_snapshot:String(frozenBatch.cvTextSnapshot??''),
    sources:Array.isArray(frozenBatch.sourcesSnapshot)?[...frozenBatch.sourcesSnapshot]:[],
    areas:Array.isArray(frozenBatch.areasSnapshot)?[...frozenBatch.areasSnapshot]:[],
    status:planned.length?'RUNNING':'NO_JOBS',
    jobs_discovered:planned.length,
    jobs_queued:jobsQueued,
    jobs_skipped:jobsSkipped,
    started_at:clean(frozenBatch.frozenAt)||null,
  }

  const {data:run,error:runError}=await supabase
    .from('night_flight_runs')
    .insert(runPayload)
    .select('id')
    .single()

  if(runError) throw new Error(`Night Flight run persistence failed: ${runError.message||'unknown Supabase error'}`)
  if(!run?.id) throw new Error('Night Flight run persistence did not return a run id')

  if(planned.length){
    const rows=planned.map((row,index)=>{
      const job=row.job?.job||row.job||{}
      return {
        run_id:run.id,
        job_key:jobKeyFor(row.job,index),
        source:sourceFor(row.job),
        job_snapshot:{...job},
        area:row.area,
        status:row.status,
      }
    })
    const {error:jobsError}=await supabase.from('night_flight_jobs').insert(rows)
    if(jobsError) throw new Error(`Night Flight jobs persistence failed: ${jobsError.message||'unknown Supabase error'}`)
  }

  return {
    runId:run.id,
    jobsDiscovered:planned.length,
    jobsQueued,
    jobsSkipped,
    status:runPayload.status,
  }
}
