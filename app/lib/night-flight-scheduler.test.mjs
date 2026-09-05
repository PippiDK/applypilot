import test from 'node:test'
import assert from 'node:assert/strict'
import {runNightFlightScheduler} from './night-flight-scheduler.js'

function makeSettingsSupabase(rows=[]){
  const calls=[]
  return {
    calls,
    from(table){
      calls.push(['from',table])
      return {
        select(columns){
          calls.push(['select',columns])
          return this
        },
        eq(column,value){
          calls.push(['eq',column,value])
          const data=column==='enabled'&&value===true?rows.filter(row=>row.enabled===true):rows
          return Promise.resolve({data,error:null})
        },
      }
    },
  }
}

test('Task 7 runs at Copenhagen 02 hour in winter CET',async()=>{
  const supabase=makeSettingsSupabase([{user_id:'winter-user',enabled:true}])
  const users=[]
  const result=await runNightFlightScheduler({
    supabase,
    now:new Date('2026-01-15T01:30:00Z'),
    runUser:async({userId})=>{users.push(userId);return {runId:'r1'}},
  })
  assert.deepEqual(users,['winter-user'])
  assert.equal(result.usersEligible,1)
  assert.deepEqual(supabase.calls.find(call=>call[0]==='eq'),['eq','enabled',true])
})

test('Task 7 runs at Copenhagen 02 hour in summer CEST',async()=>{
  const supabase=makeSettingsSupabase([{user_id:'summer-user',enabled:true}])
  const users=[]
  await runNightFlightScheduler({
    supabase,
    now:new Date('2026-07-15T00:30:00Z'),
    runUser:async({userId})=>{users.push(userId);return {runId:'r2'}},
  })
  assert.deepEqual(users,['summer-user'])
})

test('Task 7 skips the UTC candidate that is not Copenhagen local hour 02',async()=>{
  for(const now of [new Date('2026-01-15T00:30:00Z'),new Date('2026-07-15T01:30:00Z')]){
    const supabase=makeSettingsSupabase([{user_id:'should-not-run',enabled:true}])
    let calls=0
    const result=await runNightFlightScheduler({supabase,now,runUser:async()=>{calls+=1}})
    assert.equal(calls,0)
    assert.equal(result.status,'SKIPPED_TIME')
    assert.equal(supabase.calls.length,0)
  }
})

test('Task 7 dispatches only enabled settings rows',async()=>{
  const supabase=makeSettingsSupabase([
    {user_id:'enabled-user',enabled:true},
    {user_id:'disabled-user',enabled:false},
  ])
  const users=[]
  await runNightFlightScheduler({
    supabase,
    now:new Date('2026-01-15T01:10:00Z'),
    runUser:async({userId})=>{users.push(userId)},
  })
  assert.deepEqual(users,['enabled-user'])
})

test('Task 7 isolates one user failure so other enabled users still start',async()=>{
  const supabase=makeSettingsSupabase([
    {user_id:'broken-user',enabled:true},
    {user_id:'healthy-user',enabled:true},
  ])
  const users=[]
  const result=await runNightFlightScheduler({
    supabase,
    now:new Date('2026-01-15T01:20:00Z'),
    runUser:async({userId})=>{
      users.push(userId)
      if(userId==='broken-user') throw new Error('profile unavailable')
      return {runId:'healthy-run'}
    },
  })
  assert.deepEqual(users,['broken-user','healthy-user'])
  assert.equal(result.usersEligible,2)
  assert.equal(result.usersSucceeded,1)
  assert.equal(result.usersFailed,1)
})

test('Task 7 surfaces the enabled-user query failure',async()=>{
  const supabase={
    from(){
      return {select(){return this},eq(){return Promise.resolve({data:null,error:{message:'db unavailable'}})}}
    },
  }
  await assert.rejects(
    ()=>runNightFlightScheduler({supabase,now:new Date('2026-01-15T01:30:00Z'),runUser:async()=>{}}),
    /Night Flight enabled-user query failed/
  )
})
