import test from 'node:test'
import assert from 'node:assert/strict'
import {runNightFlightUser} from './night-flight-runner.js'

test('Task 7 per-user runner composes Task 4 discovery into Task 5 persistence',async()=>{
  const supabase={from(){}}
  const now=new Date('2026-07-15T00:20:00Z')
  const batch=Object.freeze({targetDate:'2026-07-14',jobs:Object.freeze([])})
  const calls=[]
  const result=await runNightFlightUser({
    supabase,
    userId:'user-1',
    now,
    discover:async input=>{calls.push(['discover',input]);return batch},
    persistAreaScope:async input=>{calls.push(['persist',input]);return {runId:'run-1',jobsDiscovered:0,jobsQueued:0,jobsSkipped:0}},
  })
  assert.equal(calls.length,2)
  assert.equal(calls[0][0],'discover')
  assert.equal(calls[0][1].supabase,supabase)
  assert.equal(calls[0][1].userId,'user-1')
  assert.equal(calls[0][1].now,now)
  assert.equal(calls[1][0],'persist')
  assert.equal(calls[1][1].supabase,supabase)
  assert.equal(calls[1][1].userId,'user-1')
  assert.equal(calls[1][1].batch,batch)
  assert.deepEqual(result,{runId:'run-1',jobsDiscovered:0,jobsQueued:0,jobsSkipped:0})
})

test('Task 7 per-user runner validates server execution inputs before discovery',async()=>{
  await assert.rejects(()=>runNightFlightUser({supabase:null,userId:'user-1'}),/Supabase client is required/)
  await assert.rejects(()=>runNightFlightUser({supabase:{from(){}},userId:''}),/Night Flight user id is required/)
})
