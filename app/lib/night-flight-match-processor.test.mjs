import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule(){
  try{return await import('./night-flight-match-processor.js')}catch{return null}
}

function fakeRunSupabase(run){
  return {
    from(table){
      assert.equal(table,'night_flight_runs')
      const filters={}
      const query={
        select(){return query},
        eq(field,value){filters[field]=value;return query},
        async maybeSingle(){
          const matches=run&&Object.entries(filters).every(([field,value])=>run[field]===value)
          return {data:matches?run:null,error:null}
        },
      }
      return query
    },
  }
}

test('Task 8 Night Flight processor uses the frozen run CV/profile context and returns cache reference to queue',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-processor.js must exist')
  const run={
    id:'run-1',user_id:'u1',profile_fingerprint:'profile-frozen',
    cv_text_snapshot:'Frozen CV text '.repeat(8),cv_source_version:'cv-v4',
  }
  const supabase=fakeRunSupabase(run)
  let serviceInput=null
  let queueInput=null
  const result=await mod.processNightFlightRunMatches({
    supabase,userId:'u1',runId:'run-1',
    matchService:async input=>{
      serviceInput=input
      return {analysis:{score:88},matchCacheKey:'cache-ref-1',cacheHit:false}
    },
    processQueue:async input=>{
      queueInput=input
      const processed=await input.processJob({job_key:'linkedin:123',job_snapshot:{title:'Senior PM',company:'Acme',location:'Copenhagen',description:'Full JD'}})
      assert.deepEqual(processed,{matchCacheKey:'cache-ref-1'})
      return {runId:'run-1',status:'READY',jobsReady:1}
    },
  })

  assert.equal(serviceInput.userId,'u1')
  assert.equal(serviceInput.profileFingerprint,'profile-frozen')
  assert.equal(serviceInput.cvText,run.cv_text_snapshot.trim())
  assert.equal(serviceInput.logicalJobKey,'linkedin:123')
  assert.equal(queueInput.runId,'run-1')
  assert.equal(queueInput.maxJobs,Infinity)
  assert.equal(result.status,'READY')
})

test('Task 8 Night Flight processor rejects missing or foreign run context',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-processor.js must exist')
  await assert.rejects(()=>mod.processNightFlightRunMatches({
    supabase:fakeRunSupabase(null),userId:'u1',runId:'missing',processQueue:async()=>({}),matchService:async()=>({}),
  }),/run.*not available/i)
  await assert.rejects(()=>mod.processNightFlightRunMatches({
    supabase:fakeRunSupabase({id:'run-1',user_id:'u2',profile_fingerprint:'x',cv_text_snapshot:'cv'}),
    userId:'u1',runId:'run-1',processQueue:async()=>({}),matchService:async()=>({}),
  }),/run.*not available/i)
})


test('Night Pilot batches uncached frozen jobs into one AI request instead of one request per vacancy',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-processor.js must exist')
  const run={
    id:'run-batch',user_id:'u1',profile_fingerprint:'profile-frozen',
    cv_text_snapshot:'Frozen CV text '.repeat(8),cv_source_version:'cv-v4',
  }
  const supabase=fakeRunSupabase(run)
  const pending=Array.from({length:12},(_,index)=>({
    run_id:'run-batch',
    job_key:`linkedin:${1000+index}`,
    status:'PROCESSING',
    updated_at:'2026-10-05T01:00:00.000Z',
    job_snapshot:{
      title:`Project Manager ${index+1}`,
      company:'Acme',
      location:'Copenhagen',
      description:(`Full job description ${index+1} with delivery governance risk stakeholders and programme responsibilities. `).repeat(3),
    },
  }))
  let next=0
  let aiCalls=0
  const completed=[]
  const cacheWrites=[]

  const result=await mod.processNightFlightRunMatches({
    supabase,userId:'u1',runId:'run-batch',
    claimJob:async()=>pending[next++]||null,
    readCache:async({logicalJobKey})=>({cacheHit:false,matchCacheKey:`cache:${logicalJobKey}`,analysis:null}),
    batchAnalyze:async({jobs,cvText})=>{
      aiCalls+=1
      assert.equal(jobs.length,12)
      assert.equal(cvText,run.cv_text_snapshot.trim())
      return {results:jobs.map(({jobKey})=>({jobKey,analysis:{expertiseMatch:80,requirements:[]}})),failures:[]}
    },
    packBatches:jobs=>[jobs],
    storeCache:async input=>{
      cacheWrites.push(input.logicalJobKey)
      return {matchCacheKey:`stored:${input.logicalJobKey}`}
    },
    completeJob:async({claimedJob,matchCacheKey})=>{completed.push([claimedJob.job_key,matchCacheKey]);return claimedJob},
    failJob:async()=>{throw new Error('unexpected failure')},
    reconcileRun:async()=>({runId:'run-batch',status:'READY',jobsReady:12,jobsFailed:0,jobsSkipped:0,unfinished:0}),
    reconcileAppliedHistory:async()=>({alreadyApplied:0}),
  })

  assert.equal(aiCalls,1,'12 uncached jobs must use one batch model request')
  assert.equal(cacheWrites.length,12)
  assert.equal(completed.length,12)
  assert.equal(result.aiBatchCallsThisInvocation,1)
  assert.equal(result.cacheHitsThisInvocation,0)
  assert.equal(result.status,'READY')
})

test('Night Pilot removes cache hits before the batch AI request',async()=>{
  const mod=await loadModule()
  const run={
    id:'run-cache',user_id:'u1',profile_fingerprint:'profile-frozen',
    cv_text_snapshot:'Frozen CV text '.repeat(8),cv_source_version:'cv-v4',
  }
  const supabase=fakeRunSupabase(run)
  const pending=Array.from({length:5},(_,index)=>({
    run_id:'run-cache',
    job_key:`linkedin:${2000+index}`,
    status:'PROCESSING',
    updated_at:'2026-10-05T01:00:00.000Z',
    job_snapshot:{
      title:`Delivery Manager ${index+1}`,
      company:'Acme',
      location:'Copenhagen',
      description:(`Full job description ${index+1} with delivery governance and stakeholder responsibilities. `).repeat(3),
    },
  }))
  let next=0
  let reads=0
  let aiJobs=[]

  const result=await mod.processNightFlightRunMatches({
    supabase,userId:'u1',runId:'run-cache',
    claimJob:async()=>pending[next++]||null,
    readCache:async({logicalJobKey})=>{
      reads+=1
      const hit=reads<=3
      return {cacheHit:hit,matchCacheKey:`cache:${logicalJobKey}`,analysis:hit?{expertiseMatch:90}:null}
    },
    batchAnalyze:async({jobs})=>{
      aiJobs=jobs.map(x=>x.jobKey)
      return {results:jobs.map(({jobKey})=>({jobKey,analysis:{expertiseMatch:75,requirements:[]}})),failures:[]}
    },
    packBatches:jobs=>[jobs],
    storeCache:async input=>({matchCacheKey:`stored:${input.logicalJobKey}`}),
    completeJob:async({claimedJob})=>claimedJob,
    failJob:async()=>{throw new Error('unexpected failure')},
    reconcileRun:async()=>({runId:'run-cache',status:'READY',jobsReady:5,jobsFailed:0,jobsSkipped:0,unfinished:0}),
    reconcileAppliedHistory:async()=>({alreadyApplied:0}),
  })

  assert.equal(result.cacheHitsThisInvocation,3)
  assert.equal(result.aiBatchCallsThisInvocation,1)
  assert.equal(aiJobs.length,2,'only cache misses may be sent to the model')
})
