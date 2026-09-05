import test from 'node:test'
import assert from 'node:assert/strict'

async function loadRecovery(){
  try{return await import('./night-flight-manual-recovery.js')}catch{return null}
}

function fakeRecoverySupabase({run,job}={}){
  const state={run:{...(run||{})},job:{...(job||{})},updates:[]}
  return {
    state,
    from(table){
      const filters={}
      let payload=null
      const query={
        select(){return query},
        update(next){payload=next;return query},
        eq(field,value){filters[field]=value;return query},
        async maybeSingle(){
          if(table==='night_flight_runs'){
            const ok=state.run.id&&Object.entries(filters).every(([field,value])=>state.run[field]===value)
            return {data:ok?{...state.run}:null,error:null}
          }
          if(table==='night_flight_jobs'){
            const ok=state.job.run_id&&Object.entries(filters).every(([field,value])=>state.job[field]===value)
            if(!ok) return {data:null,error:null}
            if(payload){
              state.job={...state.job,...payload}
              state.updates.push({...payload})
            }
            return {data:{...state.job},error:null}
          }
          throw new Error(`Unexpected table ${table}`)
        },
      }
      return query
    },
  }
}

const run={
  id:'run-11',user_id:'u1',profile_fingerprint:'profile-11',
  cv_text_snapshot:'Frozen CV text '.repeat(8),cv_source_version:'cv-11',
}
const failedJob={
  run_id:'run-11',job_key:'linkedin:11',status:'FAILED',last_error:'Automatic Match failed',
  job_snapshot:{
    source:'linkedin',sourceJobId:'11',title:'Senior Project Manager',company:'Acme A/S',location:'Copenhagen',
    publishedAt:'2026-09-05T08:00:00.000Z',description:'Complete job description for manual recovery.',
  },
}

test('Task 11 FAILED manual recovery uses shared Match service then transitions only that row to READY',async()=>{
  const mod=await loadRecovery()
  assert.ok(mod,'night-flight-manual-recovery.js must exist')
  const supabase=fakeRecoverySupabase({run,job:failedJob})
  let matchCalls=0
  let reconcileCalls=0

  const result=await mod.recoverFailedNightFlightMatch({
    supabase,userId:'u1',runId:'run-11',jobKey:'linkedin:11',
    matchService:async input=>{
      matchCalls+=1
      assert.equal(input.userId,'u1')
      assert.equal(input.profileFingerprint,'profile-11')
      assert.equal(input.cvText,run.cv_text_snapshot.trim())
      return {analysis:{expertiseMatch:88},matchCacheKey:'expertise-match:shared-11',cacheHit:false}
    },
    reconcile:async input=>{reconcileCalls+=1;assert.equal(input.runId,'run-11');return {status:'READY'}},
    now:new Date('2026-09-06T08:00:00.000Z'),
  })

  assert.equal(matchCalls,1)
  assert.equal(reconcileCalls,1)
  assert.equal(supabase.state.job.status,'READY')
  assert.equal(supabase.state.job.match_cache_key,'expertise-match:shared-11')
  assert.equal(supabase.state.job.last_error,null)
  assert.equal(result.job.status,'READY')
})

test('Task 11 Match failure leaves the FAILED Night Flight row unchanged and does not reconcile',async()=>{
  const mod=await loadRecovery()
  assert.ok(mod,'night-flight-manual-recovery.js must exist')
  const supabase=fakeRecoverySupabase({run,job:failedJob})
  let reconcileCalls=0

  await assert.rejects(()=>mod.recoverFailedNightFlightMatch({
    supabase,userId:'u1',runId:'run-11',jobKey:'linkedin:11',
    matchService:async()=>{throw new Error('AI still unavailable')},
    reconcile:async()=>{reconcileCalls+=1},
  }),/AI still unavailable/)

  assert.equal(reconcileCalls,0)
  assert.equal(supabase.state.job.status,'FAILED')
  assert.equal(supabase.state.updates.length,0)
})

test('Task 11 manual recovery is user scoped and refuses non-FAILED jobs',async()=>{
  const mod=await loadRecovery()
  assert.ok(mod,'night-flight-manual-recovery.js must exist')

  const wrongUser=fakeRecoverySupabase({run,job:failedJob})
  await assert.rejects(()=>mod.recoverFailedNightFlightMatch({
    supabase:wrongUser,userId:'u2',runId:'run-11',jobKey:'linkedin:11',matchService:async()=>({matchCacheKey:'x'}),
  }),/not available|not found|FAILED/i)

  const ready=fakeRecoverySupabase({run,job:{...failedJob,status:'READY'}})
  await assert.rejects(()=>mod.recoverFailedNightFlightMatch({
    supabase:ready,userId:'u1',runId:'run-11',jobKey:'linkedin:11',matchService:async()=>({matchCacheKey:'x'}),
  }),/FAILED/i)
})
