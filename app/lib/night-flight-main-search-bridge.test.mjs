import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const modulePath=new URL('./night-flight-main-search-bridge.js',import.meta.url)

test('Task 2 bridge module exists',()=>{
  assert.equal(fs.existsSync(modulePath),true,'night-flight-main-search-bridge.js must exist')
})

const load=()=>import('./night-flight-main-search-bridge.js')

const nf=(overrides={})=>({processed:true,source:'linkedin',matchCacheKey:'cache-1',processedAt:'2026-09-07T00:00:00Z',job:{},analysis:{expertiseMatch:82},...overrides})

test('matches a LinkedIn Search job by exact source + sourceJobId and enriches only that job',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[
    {job:{title:'A',source:'LinkedIn Jobs',sourceJobId:'4456985138'}},
    {job:{title:'B',source:'LinkedIn Jobs',sourceJobId:'999'}}
  ]
  const entry=nf()
  const result=enrichSearchJobsWithNightFlight(input,{jobs:{'linkedin:4456985138':entry}})
  assert.equal(result.length,2)
  assert.equal(result[0].job.nightFlight.processed,true)
  assert.equal(result[0].job.nightFlight.analysis,entry.analysis)
  assert.equal(result[0].job.nightFlight.matchCacheKey,'cache-1')
  assert.equal(result[1],input[1])
  assert.deepEqual(result.map(item=>item.job.title),['A','B'])
})

test('supports exact existing jobId and bare sourceJobId keys used by persisted Night Flight history',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const linkedin={job:{jobId:'linkedin:111',sourceJobId:'111',title:'LinkedIn role'}}
  const jobindex={job:{jobId:'h1695872',source:'jobindex',sourceJobId:'h1695872',title:'Jobindex role'}}
  const result=enrichSearchJobsWithNightFlight([linkedin,jobindex],{jobs:{
    'linkedin:111':nf(),
    'h1695872':nf({source:'jobindex',analysis:{expertiseMatch:63}})
  }})
  assert.equal(result[0].job.nightFlight.analysis.expertiseMatch,82)
  assert.equal(result[1].job.nightFlight.analysis.expertiseMatch,63)
})

test('uses normalized canonical/detail URL only as a fallback when stable ids are unavailable',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[{job:{title:'URL-only role',detailUrl:'https://www.linkedin.com/jobs/view/12345/?trk=feed#x'}}]
  const index={jobs:{'legacy-key':nf({job:{originalUrl:'https://www.linkedin.com/jobs/view/12345/'}})}}
  const result=enrichSearchJobsWithNightFlight(input,index)
  assert.equal(result[0].job.nightFlight.processed,true)
})

test('never fuzzy-matches company and title when no exact id or URL identity exists',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[{job:{title:'Senior Project Manager',company:'Acme',location:'Copenhagen'}}]
  const index={jobs:{'linkedin:777':nf({job:{title:'Senior Project Manager',company:'Acme',location:'Copenhagen',sourceJobId:'777'}})}}
  const result=enrichSearchJobsWithNightFlight(input,index)
  assert.equal(result[0],input[0])
  assert.equal(result[0].job.nightFlight,undefined)
})

test('keeps processed provenance even when cached Match analysis is missing',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[{job:{jobId:'linkedin:222',title:'No-cache role'}}]
  const result=enrichSearchJobsWithNightFlight(input,{jobs:{'linkedin:222':nf({matchCacheKey:null,analysis:null})}})
  assert.equal(result[0].job.nightFlight.processed,true)
  assert.equal(result[0].job.nightFlight.matchCacheKey,null)
  assert.equal(result[0].job.nightFlight.analysis,null)
})

test('does not mutate Search results or the Night Flight index',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[{evaluation:{score:90},job:{jobId:'linkedin:333',title:'Immutable'}}]
  const index={jobs:{'linkedin:333':nf()}}
  const inputSnapshot=structuredClone(input)
  const indexSnapshot=structuredClone(index)
  const result=enrichSearchJobsWithNightFlight(input,index)
  assert.deepEqual(input,inputSnapshot)
  assert.deepEqual(index,indexSnapshot)
  assert.notEqual(result[0],input[0])
  assert.notEqual(result[0].job,input[0].job)
  assert.equal(result[0].evaluation,input[0].evaluation)
})

test('returns an empty list for a non-array Search payload',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  assert.deepEqual(enrichSearchJobsWithNightFlight(null,{jobs:{}}),[])
})

test('does not use application URLs as vacancy identity fallbacks',async()=>{
  const {enrichSearchJobsWithNightFlight}=await load()
  const input=[{job:{title:'Role A',applicationUrl:'https://jobs.example.com/apply'}}]
  const index={jobs:{'legacy-key':nf({job:{title:'Role B',applicationUrl:'https://jobs.example.com/apply'}})}}
  const result=enrichSearchJobsWithNightFlight(input,index)
  assert.equal(result[0],input[0])
  assert.equal(result[0].job.nightFlight,undefined)
})
