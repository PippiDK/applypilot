import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileNightFlightAppliedHistory} from './night-flight-applied-history.js'

function clone(value){return JSON.parse(JSON.stringify(value))}

function fakeSupabase({jobs=[],applied=[]}={}){
  const state={jobs:clone(jobs),applied:clone(applied)}
  const calls=[]
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
        in(field,values){inFilters[field]=values;return query},
        then(resolve,reject){
          const source=table==='night_flight_jobs'?state.jobs:state.applied
          let rows=source.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          rows=rows.filter(row=>Object.entries(inFilters).every(([field,values])=>values.includes(row[field])))
          if(op==='update') for(const row of rows) Object.assign(row,clone(payload))
          calls.push({table,op,payload:clone(payload),filters:clone(filters),inFilters:clone(inFilters),count:rows.length})
          return Promise.resolve({data:clone(rows),error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

const jobs=[
  {run_id:'run-1',job_key:'linkedin:100',job_snapshot:{sourceJobId:'100'},status:'READY',already_applied:false},
  {run_id:'run-1',job_key:'linkedin:200',job_snapshot:{sourceJobId:'200'},status:'FAILED',already_applied:true},
  {run_id:'other-run',job_key:'linkedin:300',job_snapshot:{sourceJobId:'300'},status:'READY',already_applied:true},
]

test('NF-AA-4 marks current-run matches true and non-matches false without changing processing status',async()=>{
  const supabase=fakeSupabase({
    jobs,
    applied:[{user_id:'u1',job_id:'100'},{user_id:'u2',job_id:'200'}],
  })
  const result=await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.deepEqual(result,{runId:'run-1',jobsChecked:2,alreadyApplied:1})
  assert.equal(supabase.state.jobs[0].already_applied,true)
  assert.equal(supabase.state.jobs[0].status,'READY')
  assert.equal(supabase.state.jobs[1].already_applied,false)
  assert.equal(supabase.state.jobs[1].status,'FAILED')
  assert.equal(supabase.state.jobs[2].already_applied,true,'other runs are untouched')
})

test('NF-AA-4 reconciliation is idempotent',async()=>{
  const supabase=fakeSupabase({jobs,applied:[{user_id:'u1',job_id:'100'}]})

  await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})
  const first=clone(supabase.state.jobs)
  await reconcileNightFlightAppliedHistory({supabase,userId:'u1',runId:'run-1'})

  assert.deepEqual(supabase.state.jobs,first)
})
