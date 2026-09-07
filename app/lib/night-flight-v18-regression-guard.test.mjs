import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

import {
  lastCompletedCopenhagenDate,
  runNightFlightLastCompletedDayDiscovery,
} from './night-flight-last-completed-day.js'
import {
  DEFAULT_NIGHT_FLIGHT_SETTINGS,
  NIGHT_FLIGHT_SOURCES,
  validateNightFlightSettings,
} from './night-flight-settings.js'
import {planNightFlightAreaScope} from './night-flight-area-scope.js'
import {
  claimNextNightFlightJob,
  processNightFlightQueue,
} from './night-flight-match-queue.js'
import {
  runNightFlightForUser,
  runNightFlightScheduler,
  shouldRunNightFlightTick,
} from './night-flight-scheduler.js'
import {
  expertiseMatchCacheReference,
  logicalExpertiseJobKey,
  resolveManualExpertiseMatch,
} from './expertise-match-server-cache.js'
import {FRESHNESS_OPTIONS} from './freshness-selection.js'

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value))
const sourceText=relative=>readFile(new URL(relative,import.meta.url),'utf8')

function profileRow(fingerprint='profile-fp-1'){
  return {
    user_id:'user-v18',
    search_profile:{unionSearchPlan:{directions:[{tier:'primary',role:'Senior Project Manager',query:'Senior Project Manager'}]}},
    cv_text:`CV ${fingerprint}`,
    cv_source_version:`cv-${fingerprint}`,
    profile_fingerprint:fingerprint,
    synced_at:'2026-09-05T17:00:00.000Z',
    updated_at:'2026-09-05T17:00:00.000Z',
  }
}

function discoverySupabase(state){
  return {
    from(table){
      return {
        select(){return this},
        eq(){return this},
        async maybeSingle(){
          if(table==='night_flight_profiles') return {data:clone(state.profile),error:null}
          if(table==='night_flight_settings') return {data:clone(state.settings),error:null}
          return {data:null,error:null}
        },
      }
    },
  }
}

function discoveredItem(id,location,source='linkedin'){
  return {
    job:{
      jobId:`${source}:${id}`,
      sourceJobId:id,
      source,
      title:`Role ${id}`,
      company:'Acme',
      location,
      publishedAt:'2026-09-04T10:00:00.000Z',
      fullJd:'Full JD',
      sourceRecords:[{source,sourceJobId:id}],
    },
    nightFlightSources:[source],
  }
}

function areaBatch(areasSnapshot=[]){
  return Object.freeze({
    targetDate:'2026-09-04',
    areasSnapshot:Object.freeze([...areasSnapshot]),
    jobs:Object.freeze([
      discoveredItem('north','Nærum, Denmark'),
      discoveredItem('aarhus','Aarhus, Denmark','jobindex'),
      discoveredItem('unknown','Denmark','jobnet'),
    ]),
  })
}

function queueJob(jobKey,status,{attempts=0,updatedAt='2026-09-05T01:30:00.000Z'}={}){
  return {
    run_id:'run-v18',job_key:jobKey,source:'linkedin',
    job_snapshot:{jobId:`linkedin:${jobKey}`,title:`Role ${jobKey}`},
    area:'copenhagen_north',status,attempts,last_error:null,match_cache_key:null,
    processed_at:null,created_at:'2026-09-05T01:00:00.000Z',updated_at:updatedAt,
  }
}

function queueRun(){
  return {
    id:'run-v18',user_id:'user-v18',target_date:'2026-09-04',status:'RUNNING',
    jobs_discovered:0,jobs_queued:0,jobs_ready:0,jobs_failed:0,jobs_skipped:0,
    completed_at:null,updated_at:'2026-09-05T01:00:00.000Z',
  }
}

function queueSupabase({jobs=[],runs=[]}={}){
  const state={jobs:clone(jobs),runs:clone(runs)}
  class Query{
    constructor(table){this.table=table;this.filters=[];this.operation='select';this.payload=null;this.orderBy=null;this.limitCount=null}
    select(){return this}
    update(payload){this.operation='update';this.payload=clone(payload);return this}
    eq(field,value){this.filters.push(row=>String(row?.[field]??'')===String(value??''));return this}
    in(field,values){const allowed=new Set(values||[]);this.filters.push(row=>allowed.has(row?.[field]));return this}
    order(field,{ascending=true}={}){this.orderBy={field,ascending};return this}
    limit(count){this.limitCount=count;return this}
    rows(){
      const source=this.table==='night_flight_jobs'?state.jobs:state.runs
      let rows=source.filter(row=>this.filters.every(filter=>filter(row)))
      if(this.orderBy){const {field,ascending}=this.orderBy;rows=[...rows].sort((a,b)=>String(a?.[field]??'').localeCompare(String(b?.[field]??''))*(ascending?1:-1))}
      if(Number.isFinite(this.limitCount)) rows=rows.slice(0,this.limitCount)
      return rows
    }
    execute(){
      const rows=this.rows()
      if(this.operation==='update') for(const row of rows) Object.assign(row,clone(this.payload))
      return {data:clone(rows),error:null}
    }
    async maybeSingle(){const result=this.execute();return {data:result.data?.[0]??null,error:null}}
    async single(){const result=this.execute();return {data:result.data?.[0]??null,error:null}}
    then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject)}
  }
  return {state,from(table){return new Query(table)}}
}

test('V18-01 latest Search Profile is loaded before every Night Flight run',async()=>{
  const state={profile:profileRow('profile-fp-1'),settings:{enabled:true,sources:['linkedin'],areas:[]}}
  const seen=[]
  const args={
    supabase:discoverySupabase(state),userId:'user-v18',now:new Date('2026-09-05T10:00:00.000Z'),
    sourceRunners:{linkedin:async input=>{seen.push(input.profile.profile_fingerprint);return {jobs:[]}}},
  }
  await runNightFlightLastCompletedDayDiscovery(args)
  state.profile=profileRow('profile-fp-2')
  await runNightFlightLastCompletedDayDiscovery(args)
  assert.deepEqual(seen,['profile-fp-1','profile-fp-2'])
})

test('V18-02 Previous/Last Completed Day is exact in Europe/Copenhagen',()=>{
  assert.equal(lastCompletedCopenhagenDate(new Date('2026-03-29T00:30:00.000Z')),'2026-03-28')
  assert.equal(lastCompletedCopenhagenDate(new Date('2026-10-25T02:30:00.000Z')),'2026-10-24')
})

test('V18-03 at least one official source is mandatory',()=>{
  assert.throws(()=>validateNightFlightSettings({enabled:true,sources:[],areas:[]}),/Select at least one source/)
  assert.deepEqual(NIGHT_FLIGHT_SOURCES.map(source=>source.id),['linkedin','jobindex','jobnet'])
})

test('V18-04 zero selected areas means ALL discovered jobs are queued',()=>{
  const planned=planNightFlightAreaScope(areaBatch([]))
  assert.deepEqual(planned.map(row=>row.status),['QUEUED','QUEUED','QUEUED'])
})

test('V18-05 selected areas limit Match only and never remove discovery/history rows',()=>{
  const planned=planNightFlightAreaScope(areaBatch(['copenhagen_north']))
  assert.equal(planned.length,3)
  assert.deepEqual(planned.map(row=>row.status),['QUEUED','SKIPPED_AREA','SKIPPED_AREA'])
  assert.deepEqual(planned.map(row=>row.job.job.sourceJobId),['north','aarhus','unknown'])
})

test('V18-06 READY jobs are terminal and are never recalculated',async()=>{
  const supabase=queueSupabase({jobs:[queueJob('ready','READY'),queueJob('new','QUEUED')],runs:[queueRun()]})
  const processed=[]
  await processNightFlightQueue({
    supabase,runId:'run-v18',now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>{processed.push(claimed.job_key);return {matchCacheKey:`cache:${claimed.job_key}`}},
  })
  assert.deepEqual(processed,['new'])
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='ready').attempts,0)
})

test('V18-07 abandoned PROCESSING work is reclaimable after a crash',async()=>{
  const supabase=queueSupabase({jobs:[queueJob('crashed','PROCESSING',{attempts:1,updatedAt:'2026-09-05T01:30:00.000Z'})],runs:[queueRun()]})
  const claimed=await claimNextNightFlightJob({supabase,runId:'run-v18',now:new Date('2026-09-05T02:00:00.000Z'),leaseMs:15*60*1000})
  assert.equal(claimed.job_key,'crashed')
  assert.equal(claimed.status,'PROCESSING')
  assert.equal(claimed.attempts,2)
})

test('V18-08 one FAILED vacancy does not block the rest of the batch',async()=>{
  const supabase=queueSupabase({jobs:[queueJob('bad','QUEUED'),queueJob('good','QUEUED')],runs:[queueRun()]})
  const result=await processNightFlightQueue({
    supabase,runId:'run-v18',maxAttempts:1,now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>{if(claimed.job_key==='bad') throw new Error('bad vacancy');return {matchCacheKey:'cache:good'}},
  })
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='bad').status,'FAILED')
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='good').status,'READY')
  assert.equal(result.status,'READY_WITH_ERRORS')
})

test('V18-09 repeated scheduler invocation resumes the same user/date run',async()=>{
  let discoveryCalls=0
  let persistCalls=0
  let processCalls=0
  const supabase={from(table){assert.equal(table,'night_flight_runs');return {select(){return this},eq(){return this},async maybeSingle(){return {data:{id:'run-existing',status:'RUNNING',target_date:'2026-09-04'},error:null}}}}}
  const result=await runNightFlightForUser({
    supabase,userId:'user-v18',now:new Date('2026-09-05T02:30:00+02:00'),
    discover:async()=>{discoveryCalls++;return null},persist:async()=>{persistCalls++;return null},
    processMatches:async()=>{processCalls++;return {status:'READY'}},
  })
  assert.equal(result.runId,'run-existing')
  assert.equal(result.resumed,true)
  assert.equal(discoveryCalls,0)
  assert.equal(persistCalls,0)
  assert.equal(processCalls,1)
})

test('V18-10 CEST 02:00 scheduler window works',()=>{
  assert.equal(shouldRunNightFlightTick(new Date('2026-07-15T00:30:00.000Z')),true)
  assert.equal(shouldRunNightFlightTick(new Date('2026-07-14T23:30:00.000Z')),false)
})

test('V18-11 CET 02:00 scheduler window works',()=>{
  assert.equal(shouldRunNightFlightTick(new Date('2026-01-15T01:30:00.000Z')),true)
  assert.equal(shouldRunNightFlightTick(new Date('2026-01-15T00:30:00.000Z')),false)
})

test('V18-12 backend Night Flight execution has no browser-state dependency',async()=>{
  const scheduler=await sourceText('./night-flight-scheduler.js')
  const discovery=await sourceText('./night-flight-last-completed-day.js')
  for(const source of [scheduler,discovery]){
    assert.doesNotMatch(source,/\bwindow\b/)
    assert.doesNotMatch(source,/\bdocument\b/)
    assert.doesNotMatch(source,/\blocalStorage\b/)
    assert.doesNotMatch(source,/\bsessionStorage\b/)
  }
})

test('V18-13 Night Flight OFF starts no user runs',async()=>{
  let runCalls=0
  const supabase={from(table){assert.equal(table,'night_flight_settings');return {select(){return this},eq(){return this},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}}}}
  const result=await runNightFlightScheduler({supabase,now:new Date('2026-09-05T02:30:00+02:00'),runUser:async()=>{runCalls++;return {}}})
  assert.equal(result.usersEligible,0)
  assert.equal(runCalls,0)
  assert.equal(DEFAULT_NIGHT_FLIGHT_SETTINGS.enabled,false)
})

test('V18-14 manual and nightly Match are wired to the same Expertise Match engine/cache service',async()=>{
  const manualRoute=await sourceText('../api/expertise-match/route.js')
  const nightlyProcessor=await sourceText('./night-flight-match-processor.js')
  const cacheService=await sourceText('./expertise-match-server-cache.js')
  assert.match(manualRoute,/resolveManualExpertiseMatch/)
  assert.match(nightlyProcessor,/getOrCreateExpertiseMatch/)
  assert.match(cacheService,/analyzeExpertiseMatch/)
  assert.doesNotMatch(nightlyProcessor,/new\s+OpenAI|fetch\s*\([^)]*openai/i)
})

test('V18-15 cached Night Flight Match is reused by Manual Search with zero second AI calls',async()=>{
  const job={title:'Senior Project Manager',company:'Acme',location:'Copenhagen',publishedAt:'2026-09-04T10:00:00.000Z'}
  const profile=profileRow('profile-cache')
  const logicalJobKey=logicalExpertiseJobKey(job)
  const cacheKey=expertiseMatchCacheReference({userId:'user-v18',logicalJobKey,profileFingerprint:profile.profile_fingerprint})
  let analyzeCalls=0
  const cachedAnalysis={whyYouFit:['cached result']}
  const supabase={from(table){assert.equal(table,'expertise_match_cache');return {select(){return this},eq(){return this},async maybeSingle(){return {data:{cache_key:cacheKey,analysis:cachedAnalysis},error:null}}}}}
  const result=await resolveManualExpertiseMatch({
    supabase,userId:'user-v18',job,cvText:profile.cv_text,cvSourceVersion:profile.cv_source_version,profileState:profile,
    analyze:async()=>{analyzeCalls++;throw new Error('AI must not run on cache hit')},
  })
  assert.equal(result.cacheHit,true)
  assert.deepEqual(result.analysis,cachedAnalysis)
  assert.equal(analyzeCalls,0)
})

test('V18-16 ordinary Search freshness remains Previous / 5 / 10',()=>{
  const contract=FRESHNESS_OPTIONS.filter(option=>['yesterday','5d','10d'].includes(option.id)).map(option=>option.label)
  assert.deepEqual(contract,['Previous Day','5 Days','10 Days'])
})

test('V18-17 LinkedIn / Jobindex / Jobnet existing search routes remain present',async()=>{
  const [linkedin,jobindex,jobnet]=await Promise.all([
    sourceText('../api/linkedin-profile-search/route.js'),
    sourceText('../api/jobindex-profile-search/route.js'),
    sourceText('../api/jobnet-profile-search/route.js'),
  ])
  for(const route of [linkedin,jobindex,jobnet]) assert.match(route,/export\s+async\s+function\s+POST/)
})

test('V18-18 Profile Match content and right-panel contract remain unchanged',async()=>{
  const page=await sourceText('../page.js')
  for(const heading of ['Why you fit','Transferable strengths','Expertise gaps','Expertise breakdown']) assert.match(page,new RegExp(heading,'i'))
})

test('V18-19 Company Watch and Consultant Portals remain available outside Night Flight',async()=>{
  const page=await sourceText('../page.js')
  const companyRoute=await sourceText('../api/company-profile-search/route.js')
  const consultantRoute=await sourceText('../api/consultant-profile-search/route.js')
  assert.match(page,/Company Watch/i)
  assert.match(page,/Consultant Portals/i)
  assert.match(companyRoute,/export\s+async\s+function\s+POST/)
  assert.match(consultantRoute,/export\s+async\s+function\s+POST/)
})

test('V18-20 splash / logo / auth shell remains intact',async()=>{
  const [layout,splash,icon,middleware]=await Promise.all([
    sourceText('../layout.js'),sourceText('../components/splash-gate.js'),sourceText('../icon.svg'),sourceText('../../middleware.js'),
  ])
  assert.match(layout,/SplashGate/)
  assert.match(layout,/SignOutButton/)
  assert.match(splash,/logo/i)
  assert.match(icon,/<svg/i)
  assert.match(middleware,/middleware|updateSession|supabase/i)
})
