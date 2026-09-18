import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileNightFlightAppliedHistory} from './night-flight-applied-history.js'

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}

function fakeSupabase({runs=[],jobs=[],applied=[]}={}){
  const state={runs:clone(runs),jobs:clone(jobs),applied:clone(applied)}
  const calls=[]

  function source(table){
    if(table==='night_flight_runs') return state.runs
    if(table==='night_flight_jobs') return state.jobs
    if(table==='applied_jobs') return state.applied
    throw new Error(`unexpected table ${table}`)
  }

  return {
    state,
    calls,
    from(table){
      const filters={}
      const inFilters={}
      let payload=null
      let op='select'
      const query={
        select(){return query},
        update(value){op='update';payload=clone(value);return query},
        eq(field,value){filters[field]=value;return query},
        in(field,values){inFilters[field]=[...(values||[])];return query},
        rows(){
          let rows=source(table).filter(row=>Object.entries(filters).every(([field,value])=>String(row?.[field]??'')===String(value??'')))
          rows=rows.filter(row=>Object.entries(inFilters).every(([field,values])=>values.includes(row?.[field])))
          return rows
        },
        execute(){
          const rows=query.rows()
          if(op==='update') for(const row of rows) Object.assign(row,clone(payload))
          calls.push({table,op,payload:clone(payload),filters:clone(filters),inFilters:clone(inFilters),count:rows.length})
          return {data:clone(rows),error:null}
        },
        async maybeSingle(){
          const result=query.execute()
          return {data:result.data?.[0]??null,error:result.error}
        },
        then(resolve,reject){return Promise.resolve(query.execute()).then(resolve,reject)},
      }
      return query
    },
  }
}

const runs=[
  {id:'run-1',user_id:'u1'},
  {id:'run-2',user_id:'u2'},
]

function job(runId,id,status='READY',alreadyApplied=false){
  return {
    run_id:runId,
    job_key:`linkedin:${id}`,
    job_snapshot:{sourceJobId:id},
    status,
    already_applied:alreadyApplied,
  }
}

test('NF-AA-7 single match sets only the derived marker and preserves processing status',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[
      job('run-1','100','READY',false),
      job('run-1','200','FAILED',true),
      job('run-2','300','READY',true),
    ],
    applied:[
      {user_id:'u1',job_id:'100'},
      {user_id:'u2',job_id:'200'},
    ],
  })

  const result=await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.deepEqual(result,{runId:'run-1',jobsChecked:2,alreadyApplied:1})
  assert.equal(supabase.state.jobs[0].already_applied,true)
  assert.equal(supabase.state.jobs[0].status,'READY')
  assert.equal(supabase.state.jobs[1].already_applied,false)
  assert.equal(supabase.state.jobs[1].status,'FAILED')
  assert.equal(supabase.state.jobs[2].already_applied,true,'other user run must remain untouched')
  assert.equal(supabase.calls.some(call=>call.table==='applied_jobs'&&call.op!=='select'),false,'Applied History must remain read-only')
})

test('NF-AA-7 empty Applied History clears stale derived markers without touching technical status',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[
      job('run-1','100','READY',true),
      job('run-1','200','FAILED',true),
    ],
    applied:[],
  })

  const result=await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.equal(result.alreadyApplied,0)
  assert.deepEqual(supabase.state.jobs.map(row=>row.already_applied),[false,false])
  assert.deepEqual(supabase.state.jobs.map(row=>row.status),['READY','FAILED'])
})

test('NF-AA-7 multiple same-user Applied History matches are marked in one reconciliation',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[
      job('run-1','100'),
      job('run-1','200'),
      job('run-1','300'),
    ],
    applied:[
      {user_id:'u1',job_id:'100'},
      {user_id:'u1',job_id:'300'},
    ],
  })

  const result=await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.equal(result.alreadyApplied,2)
  assert.deepEqual(supabase.state.jobs.map(row=>row.already_applied),[true,false,true])
  const appliedReads=supabase.calls.filter(call=>call.table==='applied_jobs'&&call.op==='select')
  assert.equal(appliedReads.length,1,'reconciliation must use one Applied History batch read')
  assert.equal(appliedReads[0].filters.user_id,'u1')
})

test('NF-AA-7 Applied History rows from another user never cross-match',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[job('run-1','100', 'READY', true)],
    applied:[{user_id:'u2',job_id:'100'}],
  })

  const result=await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.equal(result.alreadyApplied,0)
  assert.equal(supabase.state.jobs[0].already_applied,false)
  const appliedRead=supabase.calls.find(call=>call.table==='applied_jobs'&&call.op==='select')
  assert.equal(appliedRead.filters.user_id,'u1')
})

test('NF-AA-7 a user cannot reconcile a Night Flight run owned by another user',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[job('run-2','999','READY',false)],
    applied:[{user_id:'u1',job_id:'999'}],
  })

  await assert.rejects(
    ()=>reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-2'}),
    /run is not available for user/,
  )

  assert.equal(supabase.state.jobs[0].already_applied,false)
  assert.equal(supabase.calls.some(call=>call.table==='night_flight_jobs'),false,'foreign run jobs must not even be read')
  assert.equal(supabase.calls.some(call=>call.table==='applied_jobs'),false,'foreign run must not trigger Applied History lookup')
})

test('NF-AA-7 reconciliation remains idempotent',async()=>{
  const supabase=fakeSupabase({
    runs,
    jobs:[
      job('run-1','100','READY',false),
      job('run-1','200','FAILED',true),
    ],
    applied:[{user_id:'u1',job_id:'100'}],
  })

  await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})
  const first=clone(supabase.state.jobs)
  await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.deepEqual(supabase.state.jobs,first)
})
