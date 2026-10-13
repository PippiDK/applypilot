import {randomUUID} from 'node:crypto'
import {lastCompletedCopenhagenDate,mergeNightFlightDiscovery} from './night-flight-last-completed-day.js'
import {loadLatestNightFlightProfileState} from './night-flight-profile-store.js'
import {loadNightFlightSettings} from './night-flight-settings-store.js'
import {validateNightFlightSettings} from './night-flight-settings.js'
import {buildDiscoverySearchPlan} from './search-query-expansion-ai.js'
import {planNightFlightAreaScope} from './night-flight-area-scope.js'
import {nightFlightIncrementalDiscoverPage,nightFlightIncrementalResolveDetail,nightFlightCopenhagenDateKey} from './night-flight-source-search.js'
import {createLinkedInStableFetcher} from './linkedin-stable-fetcher.js'

const SOURCES=['linkedin','jobindex','jobnet']
const MAX_TICK_MS=220000
const clean=value=>String(value??'').trim()
const requireSuccess=(response,action)=>{
 if(response?.error) throw new Error(action+': '+response.error.message)
 return response?.data
}
const dateBefore=date=>new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10)

/**
 * Seed separate exact Copenhagen-day snapshots, never a rolling freshness window.
 * Recovery of the most recently missed day is a separate exact-date run.
 * Initializes ALL work units before enabling claims.
 */
export async function seedNightFlightIncrementalDay({supabase,userId,targetDate,now=new Date(),
  expand=buildDiscoverySearchPlan}={}){
 if(!supabase||!userId||!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error('Night Pilot seed inputs invalid')
 const existing=requireSuccess(await supabase.from('night_flight_runs')
  .select('id,status').eq('user_id',userId).eq('target_date',targetDate).maybeSingle(),'existing run read')
 if(existing?.id) return {targetDate,existingRunId:existing.id,status:existing.status}
 let header=requireSuccess(await supabase.from('night_flight_discovery_runs')
   .select('id,initialized,expanded_plan,sources,state').eq('user_id',userId)
   .eq('target_date',targetDate).maybeSingle(),'discovery checkpoint read')
 if(!header){
  const profile=await loadLatestNightFlightProfileState({supabase,userId})
  if(!profile) throw new Error('Night Pilot profile missing')
  const settings=validateNightFlightSettings(await loadNightFlightSettings({supabase,userId}))
  const selected=settings.sources.filter(source=>SOURCES.includes(source))
  if(!selected.length) throw new Error('Night Pilot sources missing')
  const searchProfile=profile.search_profile||{}
  const plan=searchProfile.unionSearchPlan||{}
  if(!Array.isArray(plan.directions)||!plan.directions.length) throw new Error('Night Pilot role directions missing')
  const expanded=await expand({unionSearchPlan:plan})
  if(!Array.isArray(expanded?.directions)||!expanded.directions.length) throw new Error('Night Pilot expanded directions missing')
  const row={user_id:userId,target_date:targetDate,search_profile_snapshot:searchProfile,
   cv_text_snapshot:String(profile.cv_text||''),cv_source_version:clean(profile.cv_source_version),
   profile_fingerprint:clean(profile.profile_fingerprint),sources:selected,areas:settings.areas||[],
   expanded_plan:expanded,initialized:false}
  const created=await supabase.from('night_flight_discovery_runs').insert(row).select('id,initialized,expanded_plan,sources,state').single()
  if(created.error&&created.error.code!=='23505') throw new Error('Night Pilot discovery creation: '+created.error.message)
  header=created.error?requireSuccess(await supabase.from('night_flight_discovery_runs')
   .select('id,initialized,expanded_plan,sources,state').eq('user_id',userId)
   .eq('target_date',targetDate).single(),'checkpoint race read'):created.data
 }
 if(header.state!=='DISCOVERING'||header.initialized) return {targetDate,discoveryRunId:header.id,initialized:header.initialized}
 const directions=(Array.isArray(header.expanded_plan?.directions)?header.expanded_plan.directions:[])
  .filter(direction=>clean(direction?.role)&&clean(direction?.query||direction?.role))
 const units=[]
 for(const source of header.sources){
  for(let i=0;i<directions.length;i++) units.push({
   discovery_run_id:header.id,source,direction_index:i,
   phase:'DISCOVERY',next_page:0,next_detail:0
  })
 }
 if(!units.length) throw new Error('Night Pilot no valid work units')
 requireSuccess(await supabase.from('night_flight_discovery_units')
   .upsert(units,{onConflict:'discovery_run_id,source,direction_index',ignoreDuplicates:true}),'work units initialization')
 requireSuccess(await supabase.from('night_flight_discovery_runs').update({initialized:true})
   .eq('id',header.id).eq('state','DISCOVERING'),'mark initialized')
 return {targetDate,discoveryRunId:header.id,initialized:true,units:units.length}
}

/**
 * Manual Start seeds the same durable checkpoint. It never calls the legacy
 * monolithic discovery or drives another user's work through service_role.
 */
export async function runNightFlightIncrementalForUser({supabase,userId,now=new Date()}={}){
 const targetDate=lastCompletedCopenhagenDate(now)
 const seeded=await seedNightFlightIncrementalDay({supabase,userId,targetDate,now})
 if(seeded.existingRunId) return {
   runId:seeded.existingRunId,targetDate,resumed:true,
   status:seeded.status||'RUNNING',processingDeferred:true
 }
 return {runId:seeded.discoveryRunId,targetDate,
   resumed:!seeded.units,status:'DISCOVERING',processingDeferred:true}
}

export async function seedNightFlightIncrementalScheduler({supabase,now=new Date(),lookbackDays=2,
  seed=seedNightFlightIncrementalDay}={}){
 if(!supabase) throw new Error('Night Pilot scheduler requires database')
 const target=lastCompletedCopenhagenDate(now)
 const dates=[target]
 // Catch-up is exact-date, never a multi-day discovery or freshness fallback.
 for(let i=1;i<Math.max(1,Math.min(lookbackDays,2));i++) dates.push(dateBefore(dates.at(-1)))
 const active=requireSuccess(await supabase.from('night_flight_settings').select('user_id').eq('enabled',true),'enabled users')
 const results=[],failures=[]
 for(const row of active||[]){
  for(const targetDate of [...dates].reverse()){
   try{results.push(await seed({supabase,userId:row.user_id,targetDate,now}))}
   catch(error){failures.push({targetDate,error:clean(error?.message).slice(0,250)})}
  }
 }
 return {skipped:false,usersEligible:(active||[]).length,results,failures,
  usersFailed:failures.length,usersSucceeded:(active||[]).length-(failures.length>0?1:0)}
}

function stableCandidateKey(source,candidate){
 return source+':'+clean(candidate?.jobId||candidate?.sourceJobId||candidate?.jobAdId)
}
function mergeCandidates(source,previous,found){
 const foundMap=new Map()
 for(const item of [...previous,...found]){
  const key=stableCandidateKey(source,item)
  if(key===source+':') continue
  const old=foundMap.get(key)
  foundMap.set(key,old?{...old,...item,foundBy:[...new Map(
   [...(old.foundBy||[]),...(item.foundBy||[])].map(x=>[JSON.stringify(x),x])
  ).values()]}:item)
 }
 return [...foundMap.values()]
}
function boundedRequest(deadline){
 return async(url,options={})=>{
  const remaining=deadline-Date.now()
  if(remaining<=1000) throw new Error('Night Pilot source step time budget exhausted')
  return fetch(url,{...options,signal:AbortSignal.timeout(Math.min(12000,remaining-100))})
 }
}
function sourceFetcher(source,deadline){
 if(source==='linkedin') return createLinkedInStableFetcher({
   totalBudgetMs:Math.max(1000,deadline-Date.now()-1000),requestTimeoutMs:12000,
   maxAttempts:2,minIntervalMs:1800,baseBackoffMs:6000,maxBackoffMs:6000,
 })
 return boundedRequest(deadline)
}
async function checkpoint(supabase,unit,owner,phase,page,detail,candidates,jobs,error=null,retry=0,release=true){
 const result=requireSuccess(await supabase.rpc('save_night_flight_discovery_unit',{
  p_id:unit.id,p_owner:owner,p_phase:phase,p_page:page,p_detail:detail,
  p_candidates:candidates,p_jobs:jobs,p_error:error,p_retry_seconds:retry,p_release:release,
 }),'save Night Pilot checkpoint')
 if(result!==true) throw new Error('Night Pilot stale lease; checkpoint was rejected')
}
export async function processNightFlightDiscoveryUnit({supabase,unit,owner,
 now=new Date(),pageRunner=nightFlightIncrementalDiscoverPage,
 detailRunner=nightFlightIncrementalResolveDetail}={}){
 const header=requireSuccess(await supabase.from('night_flight_discovery_runs')
  .select('id,target_date,expanded_plan,search_profile_snapshot,state,initialized')
  .eq('id',unit.discovery_run_id).single(),'read frozen input')
 if(header.state!=='DISCOVERING'||!header.initialized) throw new Error('Night Pilot discovery snapshot inactive')
 const direction=header.expanded_plan.directions[unit.direction_index]
 if(!direction) throw new Error('Night Pilot checkpoint direction missing')
 const deadline=Date.now()+110000
 const fetcher=sourceFetcher(unit.source,deadline)
 const candidates=Array.isArray(unit.candidates)?[...unit.candidates]:[]
 const jobs=Array.isArray(unit.verified_jobs)?[...unit.verified_jobs]:[]
 const page=Number(unit.next_page)||0
 let detail=Number(unit.next_detail)||0
 let phase=unit.phase,nextPage=page,error=null
 if(phase==='DISCOVERY'){
   try{
     const result=await pageRunner({source:unit.source,direction,targetDate:header.target_date,page,now,fetcher})
     const next=mergeCandidates(unit.source,candidates,result.candidates||[])
     candidates.splice(0,candidates.length,...next)
     nextPage=page+1
     phase=result.hasMore?'DISCOVERY':'DETAIL'
   }catch(e){error=clean(e?.message||e).slice(0,400)}
   await checkpoint(supabase,unit,owner,phase,nextPage,detail,candidates,jobs,error,error?1800:0)
 }else if(phase==='DETAIL'){
   // The durable cursor is committed after EVERY successful JD. If a later
   // request fails or the function dies, the verified prefix is not lost.
   let resolved=0
   while(detail<candidates.length&&resolved<20&&Date.now()+18000<deadline){
     const candidate=candidates[detail]
     let outcome
     try{
       outcome=await detailRunner({source:unit.source,candidate,targetDate:header.target_date,
         exclusionRules:header.search_profile_snapshot.exclusionRules||[],now,fetcher})
     }catch(e){
       error=clean(e?.message||e).slice(0,400)
       await checkpoint(supabase,unit,owner,'DETAIL',nextPage,detail,candidates,jobs,error,1800,true)
       return {unitId:unit.id,source:unit.source,directionIndex:unit.direction_index,
         phase:'DETAIL',page:nextPage,detail,candidates:candidates.length,verifiedJobs:jobs.length,error}
     }
     if(outcome?.job&&nightFlightCopenhagenDateKey(outcome.job.publishedAt)===header.target_date){
       jobs.push(outcome)
     }
     detail+=1
     resolved+=1
     await checkpoint(supabase,unit,owner,'DETAIL',nextPage,detail,candidates,jobs,null,0,false)
   }
   phase=detail>=candidates.length?'DONE':'DETAIL'
   await checkpoint(supabase,unit,owner,phase,nextPage,detail,candidates,jobs)
 }else throw new Error('Unexpected Night Pilot checkpoint phase')
 return {unitId:unit.id,source:unit.source,directionIndex:unit.direction_index,
  phase,page:nextPage,detail,candidates:candidates.length,verifiedJobs:jobs.length,error}
}

function frozenRows(items,areas,targetDate){
 const planned=planNightFlightAreaScope({targetDate,areasSnapshot:areas,jobs:items})
 return planned.map((entry,i)=>{
  const job=entry.job?.job||entry.job||{}
  const source=clean(entry.job?.nightFlightSources?.[0]||job.source||job.sourceRecords?.[0]?.source).toLowerCase()
  const jobKey=clean(job.jobId)||(source+':'+clean(job.sourceJobId||job.sourceRecords?.[0]?.sourceJobId))
  if(!SOURCES.includes(source)||!jobKey) throw new Error('Night Pilot invalid frozen job identity')
  return {job_key:jobKey,source,job_snapshot:job,area:entry.area,status:entry.status}
 })
}
export async function tryFreezeNightFlightDiscovery({supabase,discoveryRunId}={}){
 const header=requireSuccess(await supabase.from('night_flight_discovery_runs')
  .select('id,target_date,areas,state,initialized,frozen_run_id')
  .eq('id',discoveryRunId).single(),'read discovery header')
 if(header.state==='FROZEN') return {frozen:true,runId:header.frozen_run_id}
 if(!header.initialized||header.state!=='DISCOVERING') return {frozen:false}
 const units=requireSuccess(await supabase.from('night_flight_discovery_units')
  .select('phase,verified_jobs,last_error,source').eq('discovery_run_id',discoveryRunId),'read final checkpoints')
 if(!units?.length||units.some(unit=>unit.phase!=='DONE')) return {frozen:false}
 // Prevent silently passing partial/failed descriptions to Matching.
 if(units.some(unit=>unit.last_error)) return {frozen:false,errors:units.filter(unit=>unit.last_error).length}
 const sourceResults=SOURCES.map(source=>({source,jobs:units.filter(unit=>unit.source===source)
  .flatMap(unit=>Array.isArray(unit.verified_jobs)?unit.verified_jobs:[])}))
 const items=mergeNightFlightDiscovery(sourceResults).filter(item=>
   nightFlightCopenhagenDateKey(item.job?.publishedAt)===header.target_date)
 const rows=frozenRows(items,header.areas,header.target_date)
 const runId=requireSuccess(await supabase.rpc('freeze_night_flight_discovery',{
   p_discovery_run_id:discoveryRunId,p_rows:rows
 }),'atomic freeze')
 return {frozen:true,runId,jobs:rows.length}
}
/**
 * Runs bounded work only. A worker invocation may stop at any checkpoint,
 * and later workers resume via transactional claims.
 */
function copenhagenHour(now){
 const pieces=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',
   hour:'2-digit',hourCycle:'h23'}).formatToParts(now)
 return Number(pieces.find(item=>item.type==='hour')?.value)
}
export async function advanceNightFlightIncrementalDiscovery({supabase,now=new Date(),
 maxSteps=4,runStep=processNightFlightDiscoveryUnit}={}){
 if(!supabase) throw new Error('Night Pilot discovery worker requires database')
 const owner=randomUUID(),start=Date.now(),steps=[],errors=[]
 let seeded=null
 // If the 02:00 scheduler request failed, the next hourly worker must recover
 // the missing exact-date checkpoint rather than waiting another calendar day.
 if(copenhagenHour(now)>=2){
  try{seeded=await seedNightFlightIncrementalScheduler({supabase,now})}
  catch(error){errors.push({stage:'seed',error:clean(error?.message).slice(0,250)})}
 }
 for(let i=0;i<Math.min(Math.max(maxSteps,1),8)&&Date.now()-start<MAX_TICK_MS-115000;i++){
  const claimed=requireSuccess(await supabase.rpc('claim_night_flight_discovery_unit',{
   p_owner:owner,p_lease_seconds:180
  }),'claim Night Pilot unit')
  const unit=Array.isArray(claimed)?claimed[0]:null
  if(!unit) break
  try{steps.push(await runStep({supabase,unit,owner,now}))}
  catch(e){errors.push({unitId:unit.id,error:clean(e?.message).slice(0,250)});break}
 }
 const pending=requireSuccess(await supabase.from('night_flight_discovery_runs')
  .select('id').eq('state','DISCOVERING').eq('initialized',true)
  .order('target_date',{ascending:true}).limit(12),'find pending freezes')
 const frozen=[]
 for(const item of pending||[]){
  try{const outcome=await tryFreezeNightFlightDiscovery({supabase,discoveryRunId:item.id});if(outcome.frozen)frozen.push(outcome)}
  catch(e){errors.push({runId:item.id,error:clean(e?.message).slice(0,250)})}
 }
 return {seeded,steps,frozen,errors}
}
