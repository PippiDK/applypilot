import test from 'node:test'
import assert from 'node:assert/strict'
import {processNightFlightRunMatches} from './night-flight-match-processor.js'

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

const run={
  id:'run-1',
  user_id:'u1',
  profile_fingerprint:'profile-frozen',
  cv_text_snapshot:'Frozen CV text '.repeat(8),
  cv_source_version:'cv-v4',
}

test('NF-AA-4 reconciles Applied History only after a final Night Flight run state',async()=>{
  const supabase=fakeRunSupabase(run)
  let input=null
  const result=await processNightFlightRunMatches({
    supabase,
    userId:'u1',
    runId:'run-1',
    processQueue:async()=>({runId:'run-1',status:'READY',jobsReady:1}),
    matchService:async()=>({matchCacheKey:'cache'}),
    reconcileAppliedHistory:async value=>{input=value;return {alreadyApplied:2}},
  })

  assert.equal(input.userId,'u1')
  assert.equal(input.runId,'run-1')
  assert.equal(result.status,'READY')
  assert.equal(result.alreadyAppliedReconciled,true)
  assert.equal(result.alreadyAppliedCount,2)
})

test('NF-AA-4 keeps reconciliation failure non-blocking and preserves final Night Flight status',async()=>{
  const supabase=fakeRunSupabase(run)
  const result=await processNightFlightRunMatches({
    supabase,
    userId:'u1',
    runId:'run-1',
    processQueue:async()=>({runId:'run-1',status:'READY_WITH_ERRORS',jobsReady:1,jobsFailed:1}),
    matchService:async()=>({matchCacheKey:'cache'}),
    reconcileAppliedHistory:async()=>{throw new Error('Applied History temporarily unavailable')},
  })

  assert.equal(result.status,'READY_WITH_ERRORS')
  assert.equal(result.jobsReady,1)
  assert.equal(result.jobsFailed,1)
  assert.equal(result.alreadyAppliedReconciled,false)
})

test('NF-AA-4 does not reconcile while Night Flight is still RUNNING',async()=>{
  const supabase=fakeRunSupabase(run)
  let calls=0
  const result=await processNightFlightRunMatches({
    supabase,
    userId:'u1',
    runId:'run-1',
    processQueue:async()=>({runId:'run-1',status:'RUNNING',jobsReady:3}),
    matchService:async()=>({matchCacheKey:'cache'}),
    reconcileAppliedHistory:async()=>{calls+=1;return {alreadyApplied:1}},
  })

  assert.equal(calls,0)
  assert.equal(result.status,'RUNNING')
  assert.equal('alreadyAppliedReconciled' in result,false)
})
