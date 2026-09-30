import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runNightFlightWorker} from './night-flight-worker.js'

function fakeSupabase(runs=[]){
  return {
    from(table){
      assert.equal(table,'night_flight_runs')
      const filters={}
      let limitCount=Infinity
      const query={
        select(){return query},
        eq(field,value){filters[field]=value;return query},
        order(){return query},
        limit(value){limitCount=value;return query},
        then(resolve,reject){
          const data=runs
            .filter(row=>Object.entries(filters).every(([field,value])=>row?.[field]===value))
            .sort((a,b)=>String(b.target_date||'').localeCompare(String(a.target_date||''))||String(a.created_at||'').localeCompare(String(b.created_at||'')))
            .slice(0,limitCount)
          return Promise.resolve({data,error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

test('recurring worker advances the newest RUNNING run with the existing Match processor',async()=>{
  const supabase=fakeSupabase([
    {id:'old',user_id:'u1',target_date:'2026-09-27',status:'RUNNING',created_at:'2026-09-28T00:00:00Z'},
    {id:'new',user_id:'u1',target_date:'2026-09-29',status:'RUNNING',created_at:'2026-09-30T00:00:00Z'},
    {id:'done',user_id:'u1',target_date:'2026-09-30',status:'READY',created_at:'2026-09-30T01:00:00Z'},
  ])
  const calls=[]
  const result=await runNightFlightWorker({
    supabase,
    processMatches:async input=>{
      calls.push([input.userId,input.runId])
      return {status:'RUNNING',jobsProcessedThisInvocation:3}
    },
  })
  assert.deepEqual(calls,[['u1','new']])
  assert.equal(result.idle,false)
  assert.equal(result.runId,'new')
  assert.equal(result.jobsProcessedThisInvocation,3)
})

test('recurring worker skips a temporarily blocked RUNNING run and advances the next candidate',async()=>{
  const supabase=fakeSupabase([
    {id:'new',user_id:'u1',target_date:'2026-09-29',status:'RUNNING',created_at:'2026-09-30T00:00:00Z'},
    {id:'older',user_id:'u1',target_date:'2026-09-28',status:'RUNNING',created_at:'2026-09-29T00:00:00Z'},
  ])
  const calls=[]
  const result=await runNightFlightWorker({
    supabase,
    processMatches:async({runId})=>{
      calls.push(runId)
      if(runId==='new') return {status:'RUNNING',jobsProcessedThisInvocation:0}
      return {status:'RUNNING',jobsProcessedThisInvocation:2}
    },
  })
  assert.deepEqual(calls,['new','older'])
  assert.equal(result.runId,'older')
  assert.equal(result.candidatesScanned,2)
})

test('recurring worker is safely idle when no RUNNING work can progress',async()=>{
  const supabase=fakeSupabase([
    {id:'blocked',user_id:'u1',target_date:'2026-09-29',status:'RUNNING',created_at:'2026-09-30T00:00:00Z'},
  ])
  const result=await runNightFlightWorker({
    supabase,
    processMatches:async()=>({status:'RUNNING',jobsProcessedThisInvocation:0}),
  })
  assert.equal(result.idle,true)
  assert.equal(result.candidatesScanned,1)
})


test('recurring worker cron route stays protected and server-side',async()=>{
  const source=await readFile(new URL('../api/cron/night-flight-worker/route.js',import.meta.url),'utf8')
  assert.match(source,/CRON_SECRET/)
  assert.match(source,/authorization/i)
  assert.match(source,/Bearer/)
  assert.match(source,/createAdminSupabaseClient/)
  assert.match(source,/runNightFlightWorker/)
})


test('recurring worker accepts an adaptive processor that can finish many jobs in one tick',async()=>{
  const supabase=fakeSupabase([
    {id:'run-15',user_id:'u1',target_date:'2026-09-29',status:'RUNNING',created_at:'2026-09-30T00:00:00Z'},
  ])
  const result=await runNightFlightWorker({
    supabase,
    processMatches:async()=>({status:'READY',jobsProcessedThisInvocation:15}),
  })
  assert.equal(result.idle,false)
  assert.equal(result.jobsProcessedThisInvocation,15)
  assert.equal(result.status,'READY')
})
