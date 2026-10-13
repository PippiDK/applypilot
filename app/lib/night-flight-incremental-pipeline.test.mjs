import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {
 nightFlightIncrementalDiscoverPage
} from './night-flight-source-search.js'
import {
 processNightFlightDiscoveryUnit,seedNightFlightIncrementalScheduler,
 tryFreezeNightFlightDiscovery
} from './night-flight-incremental-pipeline.js'

const direction={role:'Senior IT Project Manager',query:'Senior IT Project Manager',tier:'primary'}
const header={id:'discovery-1',target_date:'2026-10-12',
 state:'DISCOVERING',initialized:true,
 expanded_plan:{directions:[direction]},
 search_profile_snapshot:{exclusionRules:[]},
 areas:['greater_copenhagen']}
const candidate={jobId:'4477508924',publishedAt:'2026-10-12T11:00:00Z',title:'Senior IT Project Manager',foundBy:[direction]}
function fakeCheckpointDB(){
 const writes=[],rpcCalls=[]
 return {writes,rpcCalls,
  from(table){
   if(table==='night_flight_discovery_runs') return {
    select(){return this},eq(){return this},
    async single(){return {data:header,error:null}}
   }
   throw Error('unexpected table '+table)
  },
  async rpc(name,args){
   rpcCalls.push({name,args})
   if(name==='save_night_flight_discovery_unit'){writes.push(args);return {data:true,error:null}}
   throw Error('unexpected rpc '+name)
  }
 }
}
function unit(phase='DISCOVERY',candidates=[],nextDetail=0){
 return {id:'unit-1',discovery_run_id:'discovery-1',source:'linkedin',
   direction_index:0,phase,next_page:1,next_detail:nextDetail,
   candidates,verified_jobs:[]}
}

test('Night Pilot page checkpoint persists before any detail fetch',async()=>{
 const supabase=fakeCheckpointDB()
 let details=0
 const result=await processNightFlightDiscoveryUnit({
  supabase,unit:unit(),owner:'owner-1',
  pageRunner:async input=>{
   assert.equal(input.targetDate,'2026-10-12')
   assert.equal(input.page,1)
   return {candidates:[candidate],hasMore:false}
  },
  detailRunner:async()=>{details++;return null},
 })
 assert.equal(details,0)
 assert.equal(result.phase,'DETAIL')
 assert.equal(supabase.writes[0].p_page,2)
 assert.equal(supabase.writes[0].p_detail,0)
 assert.equal(supabase.writes[0].p_candidates.length,1)
})

test('Night Pilot resumes a JD cursor without repeating discovery',async()=>{
 const supabase=fakeCheckpointDB()
 let pages=0,details=0
 const result=await processNightFlightDiscoveryUnit({
  supabase,unit:unit('DETAIL',[candidate]),owner:'owner-2',
  pageRunner:async()=>{pages++;throw Error('must not rediscover')},
  detailRunner:async()=>{details++;return {job:{source:'linkedin',sourceJobId:'4477508924',
    publishedAt:'2026-10-12T11:00:00Z',fullJd:'verified'},
    evaluation:{score:8}}},
 })
 assert.equal(pages,0)
 assert.equal(details,1)
 assert.equal(result.phase,'DONE')
 assert.equal(supabase.writes[0].p_jobs.length,1)
 assert.equal(supabase.writes[0].p_detail,1)
})

test('Network failure retains JD cursor and schedules a durable retry',async()=>{
 const supabase=fakeCheckpointDB()
 const result=await processNightFlightDiscoveryUnit({
  supabase,unit:unit('DETAIL',[candidate]),owner:'owner-3',
  detailRunner:async()=>{throw Error('HTTP 429')},
 })
 assert.equal(result.phase,'DETAIL')
 assert.equal(result.detail,0)
 assert.match(result.error,/429/)
 assert.equal(supabase.writes[0].p_retry_seconds,1800)
})

test('Catch-up creates independent exact dates; never uses a 3-day freshness window',async()=>{
 const called=[]
 const supabase={from(){return {
  select(){return this},eq(){return Promise.resolve({data:[{user_id:'u1'}],error:null})}
 }}}
 const result=await seedNightFlightIncrementalScheduler({
  supabase,now:new Date('2026-10-13T10:00:00Z'),
  seed:async({targetDate})=>{called.push(targetDate);return {targetDate}}
 })
 assert.deepEqual(called,['2026-10-11','2026-10-12'])
 assert.equal(result.failures.length,0)
})

test('Unfinished discovery cannot be frozen or sent to Match',async()=>{
 const db={from(name){
   let current=name
   return {
    select(){return this},eq(){return this},
    async single(){return {data:header,error:null}},
    then(resolve){return Promise.resolve({data:[{phase:'DETAIL',verified_jobs:[]}],error:null}).then(resolve)}
   }
 }}
 const result=await tryFreezeNightFlightDiscovery({supabase:db,discoveryRunId:'discovery-1'})
 assert.equal(result.frozen,false)
})

test('Night Pilot source adapters use exact targetDate, not normal Search freshnessDays',async()=>{
 const html='<li><a href="https://www.linkedin.com/jobs/view/test-4477508924/"></a>'+
   '<h3 class="base-search-card__title">Senior IT Project Manager</h3>'+
   '<h4 class="base-search-card__subtitle">Acme</h4>'+
   '<span class="job-search-card__location">Copenhagen</span>'+
   '<time datetime="2026-10-12T11:00:00Z"></time></li>'
 const result=await nightFlightIncrementalDiscoverPage({
   source:'linkedin',direction,targetDate:'2026-10-12',
   page:0,now:new Date('2026-10-13T01:00:00Z'),
   fetcher:async()=>html,
 })
 assert.equal(result.candidates.length,1)
 assert.equal(result.candidates[0].jobId,'4477508924')
 assert.equal(result.hasMore,false)
})

test('Cron routes opt into independent incremental pipeline',async()=>{
 const scheduler=await readFile(new URL('../api/cron/night-flight/route.js',import.meta.url),'utf8')
 const worker=await readFile(new URL('../api/cron/night-flight-worker/route.js',import.meta.url),'utf8')
 assert.match(scheduler,/incremental:true/)
 assert.match(worker,/incremental:true/)
 const code=await readFile(new URL('./night-flight-incremental-pipeline.js',import.meta.url),'utf8')
 assert.doesNotMatch(code,/linkedin-profile-search|searchLinkedInProfile|searchLinkedInShadow|freshnessDays/)
})
