import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadAppliedHistoryJobIdsForNightFlightRun,
  nightFlightAppliedHistoryJobId,
} from './night-flight-applied-history.js'

function fakeSupabase({jobs=[],applied=[]}={}){
  const calls=[]
  return {
    calls,
    from(table){
      const filters={}
      const inFilters={}
      const query={
        select(fields){calls.push({table,op:'select',fields,filters,inFilters});return query},
        eq(field,value){filters[field]=value;return query},
        in(field,values){inFilters[field]=values;return query},
        then(resolve,reject){
          let rows=table==='night_flight_jobs'?jobs:table==='applied_jobs'?applied:[]
          rows=rows.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          rows=rows.filter(row=>Object.entries(inFilters).every(([field,values])=>values.includes(row[field])))
          return Promise.resolve({data:rows,error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

test('NF-AA-3 resolves the Applied History id from sourceJobId and safe job_key fallbacks',()=>{
  assert.equal(nightFlightAppliedHistoryJobId({
    job_key:'linkedin:4455979300',
    job_snapshot:{sourceJobId:'4455979300'},
  }),'4455979300')
  assert.equal(nightFlightAppliedHistoryJobId({
    job_key:'linkedin:4464322827',
    job_snapshot:{},
  }),'4464322827')
  assert.equal(nightFlightAppliedHistoryJobId({
    job_key:'company:Danske Bank:24569',
    job_snapshot:{},
  }),'company:Danske Bank:24569')
})

test('NF-AA-3 performs one user-scoped batch Applied History lookup for all current-run job ids',async()=>{
  const supabase=fakeSupabase({
    jobs:[
      {run_id:'run-1',job_key:'linkedin:100',job_snapshot:{sourceJobId:'100'}},
      {run_id:'run-1',job_key:'linkedin:200',job_snapshot:{sourceJobId:'200'}},
      {run_id:'run-1',job_key:'linkedin:200',job_snapshot:{sourceJobId:'200'}},
      {run_id:'other-run',job_key:'linkedin:999',job_snapshot:{sourceJobId:'999'}},
    ],
    applied:[
      {user_id:'user-1',job_id:'100'},
      {user_id:'user-1',job_id:'999'},
      {user_id:'other-user',job_id:'200'},
    ],
  })

  const matched=await loadAppliedHistoryJobIdsForNightFlightRun({
    supabase,
    userId:'user-1',
    runId:'run-1',
  })

  assert.deepEqual([...matched],['100'])
  const appliedReads=supabase.calls.filter(call=>call.table==='applied_jobs'&&call.op==='select')
  assert.equal(appliedReads.length,1,'Applied History must be read once per reconciliation, not once per vacancy')
  assert.equal(appliedReads[0].filters.user_id,'user-1')
  assert.deepEqual(appliedReads[0].inFilters.job_id,['100','200'])
})

test('NF-AA-3 skips Applied History entirely when the current run contains no job ids',async()=>{
  const supabase=fakeSupabase({jobs:[]})
  const matched=await loadAppliedHistoryJobIdsForNightFlightRun({
    supabase,
    userId:'user-1',
    runId:'run-empty',
  })

  assert.equal(matched.size,0)
  assert.equal(supabase.calls.some(call=>call.table==='applied_jobs'),false)
})

test('NF-AA-3 requires the authenticated user and run id',async()=>{
  const supabase=fakeSupabase()
  await assert.rejects(
    ()=>loadAppliedHistoryJobIdsForNightFlightRun({supabase,userId:'',runId:'run-1'}),
    /requires userId and runId/,
  )
  await assert.rejects(
    ()=>loadAppliedHistoryJobIdsForNightFlightRun({supabase,userId:'user-1',runId:''}),
    /requires userId and runId/,
  )
})
