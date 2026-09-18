import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const moduleUrl=new URL('./night-flight-index.js',import.meta.url)

function chain(result){
  return {
    select(){return this},
    eq(){return this},
    in(){return this},
    order(){return this},
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
  }
}

function fakeSupabase({runs=[],jobs=[],cache=[]}={}){
  const calls=[]
  return {
    calls,
    from(table){
      calls.push(table)
      if(table==='night_flight_runs') return chain({data:runs,error:null})
      if(table==='night_flight_jobs') return chain({data:jobs,error:null})
      if(table==='expertise_match_cache') return chain({data:cache,error:null})
      throw new Error(`unexpected table ${table}`)
    }
  }
}

async function loadModule(){
  assert.equal(fs.existsSync(moduleUrl),true,'night-flight-index.js must exist')
  return import(moduleUrl.href)
}

test('loads READY Night Flight jobs across multiple runs and joins cached analysis',async()=>{
  const {loadNightFlightIndex}=await loadModule()
  const supabase=fakeSupabase({
    runs:[
      {id:'run-new',target_date:'2026-09-07',cv_source_version:'cv-v2'},
      {id:'run-old',target_date:'2026-09-06',cv_source_version:'cv-v1'}
    ],
    jobs:[
      {run_id:'run-new',job_key:'linkedin:100',source:'linkedin',job_snapshot:{title:'New'},status:'READY',match_cache_key:'cache-new',processed_at:'2026-09-07T02:00:00Z'},
      {run_id:'run-old',job_key:'linkedin:200',source:'linkedin',job_snapshot:{title:'Old'},status:'READY',match_cache_key:'cache-old',processed_at:'2026-09-06T02:00:00Z'}
    ],
    cache:[
      {cache_key:'cache-new',analysis:{score:91}},
      {cache_key:'cache-old',analysis:{score:83}}
    ]
  })

  const result=await loadNightFlightIndex({supabase,userId:'user-1'})

  assert.deepEqual(result.jobs['linkedin:100'].analysis,{score:91})
  assert.deepEqual(result.jobs['linkedin:200'].analysis,{score:83})
  assert.equal(result.jobs['linkedin:100'].processed,true)
  assert.equal(result.jobs['linkedin:100'].cvSourceVersion,'cv-v2')
  assert.equal(result.jobs['linkedin:200'].cvSourceVersion,'cv-v1')
  assert.deepEqual(supabase.calls,['night_flight_runs','night_flight_jobs','expertise_match_cache'])
})

test('keeps the newest occurrence when the same job was processed in multiple runs',async()=>{
  const {loadNightFlightIndex}=await loadModule()
  const supabase=fakeSupabase({
    runs:[
      {id:'run-new',target_date:'2026-09-07',cv_source_version:'cv-new'},
      {id:'run-old',target_date:'2026-09-06',cv_source_version:'cv-old'}
    ],
    jobs:[
      {run_id:'run-old',job_key:'linkedin:100',source:'linkedin',job_snapshot:{title:'Old snapshot'},status:'READY',match_cache_key:'cache-old',processed_at:'2026-09-06T02:00:00Z'},
      {run_id:'run-new',job_key:'linkedin:100',source:'linkedin',job_snapshot:{title:'New snapshot'},status:'READY',match_cache_key:'cache-new',processed_at:'2026-09-07T02:00:00Z'}
    ],
    cache:[
      {cache_key:'cache-new',analysis:{score:92}},
      {cache_key:'cache-old',analysis:{score:80}}
    ]
  })

  const result=await loadNightFlightIndex({supabase,userId:'user-1'})
  assert.equal(result.jobs['linkedin:100'].job.title,'New snapshot')
  assert.deepEqual(result.jobs['linkedin:100'].analysis,{score:92})
  assert.equal(result.jobs['linkedin:100'].cvSourceVersion,'cv-new')
})

test('returns processed Night Flight entry with null analysis when Match cache is unavailable',async()=>{
  const {loadNightFlightIndex}=await loadModule()
  const supabase=fakeSupabase({
    runs:[{id:'run-1',target_date:'2026-09-07',cv_source_version:'cv-v1'}],
    jobs:[{run_id:'run-1',job_key:'linkedin:300',source:'linkedin',job_snapshot:{title:'No cache'},status:'READY',match_cache_key:null,processed_at:'2026-09-07T02:00:00Z'}]
  })
  const result=await loadNightFlightIndex({supabase,userId:'user-1'})
  assert.equal(result.jobs['linkedin:300'].processed,true)
  assert.equal(result.jobs['linkedin:300'].analysis,null)
  assert.equal(result.jobs['linkedin:300'].cvSourceVersion,'cv-v1')
})

test('returns an empty index without querying jobs when user has no Night Flight runs',async()=>{
  const {loadNightFlightIndex}=await loadModule()
  const supabase=fakeSupabase({runs:[]})
  const result=await loadNightFlightIndex({supabase,userId:'user-1'})
  assert.deepEqual(result,{jobs:{}})
  assert.deepEqual(supabase.calls,['night_flight_runs'])
})

test('rejects missing authenticated user id',async()=>{
  const {loadNightFlightIndex}=await loadModule()
  await assert.rejects(()=>loadNightFlightIndex({supabase:fakeSupabase(),userId:''}),/Authenticated user is required/)
})

test('F1 builds the existing Night Flight stable key from Search source and sourceJobId',async()=>{
  const {nightFlightSearchJobKey}=await loadModule()
  assert.equal(nightFlightSearchJobKey({source:'linkedin',sourceJobId:'4457976275'}),'linkedin:4457976275')
  assert.equal(nightFlightSearchJobKey({source:'linkedin',sourceJobId:'linkedin:4457976275'}),'linkedin:4457976275')
})

test('F1 returns saved Night Flight analysis for the same vacancy and CV version',async()=>{
  const {findReusableNightFlightMatch}=await loadModule()
  const analysis={expertiseMatch:84,whyYouFit:['Delivery']}
  const index={jobs:{
    'linkedin:4457976275':{analysis,cvSourceVersion:'cv-v7',matchCacheKey:'cache-1',processedAt:'2026-09-18T01:00:00Z'}
  }}

  const result=findReusableNightFlightMatch({
    index,
    job:{source:'linkedin',sourceJobId:'4457976275'},
    cvSourceVersion:'cv-v7'
  })

  assert.equal(result?.jobKey,'linkedin:4457976275')
  assert.equal(result?.analysis,analysis)
  assert.equal(result?.matchCacheKey,'cache-1')
})

test('F1 returns null when Night Flight has no saved result for the vacancy',async()=>{
  const {findReusableNightFlightMatch}=await loadModule()
  const result=findReusableNightFlightMatch({
    index:{jobs:{}},
    job:{source:'linkedin',sourceJobId:'123'},
    cvSourceVersion:'cv-v1'
  })
  assert.equal(result,null)
})

test('F1 returns null when saved Match belongs to another CV source version',async()=>{
  const {findReusableNightFlightMatch}=await loadModule()
  const result=findReusableNightFlightMatch({
    index:{jobs:{'linkedin:123':{analysis:{expertiseMatch:90},cvSourceVersion:'cv-old'}}},
    job:{source:'linkedin',sourceJobId:'123'},
    cvSourceVersion:'cv-current'
  })
  assert.equal(result,null)
})
