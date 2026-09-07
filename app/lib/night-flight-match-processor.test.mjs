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
