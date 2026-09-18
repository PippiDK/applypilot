import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NIGHT_FLIGHT_RETENTION_DAYS,
  NIGHT_FLIGHT_TERMINAL_STATUSES,
  nightFlightRetentionCutoffDate,
  cleanupNightFlightRuns,
} from './night-flight-retention.js'

function fakeSupabase(rows=[]){
  const state={runs:structuredClone(rows)}
  const calls=[]
  return {
    state,
    calls,
    from(table){
      calls.push({table,op:'from'})
      if(table!=='night_flight_runs') throw new Error(`unexpected table ${table}`)
      let op='select'
      let ltFilter=null
      let inFilter=null
      const query={
        delete(){op='delete';calls.push({table,op:'delete'});return query},
        lt(field,value){ltFilter={field,value};calls.push({table,op:'lt',field,value});return query},
        in(field,values){inFilter={field,values:[...values]};calls.push({table,op:'in',field,values:[...values]});return query},
        select(fields){calls.push({table,op:'select',fields});return query},
        then(resolve,reject){
          let matched=state.runs.filter(row=>{
            const ltOk=!ltFilter||String(row?.[ltFilter.field]??'')<String(ltFilter.value)
            const inOk=!inFilter||inFilter.values.includes(row?.[inFilter.field])
            return ltOk&&inOk
          })
          if(op==='delete'){
            const deletedIds=new Set(matched.map(row=>row.id))
            state.runs=state.runs.filter(row=>!deletedIds.has(row.id))
          }
          return Promise.resolve({data:structuredClone(matched),error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

test('F4 retention cutoff is 15 Copenhagen calendar days and keeps the exact boundary',()=>{
  assert.equal(NIGHT_FLIGHT_RETENTION_DAYS,15)
  assert.deepEqual(NIGHT_FLIGHT_TERMINAL_STATUSES,['READY','READY_WITH_ERRORS','NO_JOBS','FAILED'])
  assert.equal(nightFlightRetentionCutoffDate(new Date('2026-09-18T12:00:00.000Z')),'2026-09-03')
  assert.equal(nightFlightRetentionCutoffDate(new Date('2026-03-29T01:30:00.000Z')),'2026-03-14')
})

test('F4 deletes only terminal Night Flight runs older than the cutoff',async()=>{
  const supabase=fakeSupabase([
    {id:'old-ready',target_date:'2026-09-02',status:'READY'},
    {id:'old-failed',target_date:'2026-09-01',status:'FAILED'},
    {id:'boundary',target_date:'2026-09-03',status:'READY_WITH_ERRORS'},
    {id:'recent',target_date:'2026-09-17',status:'NO_JOBS'},
    {id:'old-running',target_date:'2026-08-01',status:'RUNNING'},
  ])

  const result=await cleanupNightFlightRuns({supabase,now:new Date('2026-09-18T12:00:00.000Z')})

  assert.equal(result.cutoffDate,'2026-09-03')
  assert.equal(result.deletedRuns,2)
  assert.deepEqual(result.deletedRunIds.sort(),['old-failed','old-ready'])
  assert.deepEqual(supabase.state.runs.map(row=>row.id),['boundary','recent','old-running'])
  assert.equal(supabase.calls.some(call=>call.table!=='night_flight_runs'),false)
})

test('F4 cleanup is idempotent',async()=>{
  const supabase=fakeSupabase([{id:'old',target_date:'2026-09-01',status:'READY'}])
  const first=await cleanupNightFlightRuns({supabase,now:new Date('2026-09-18T12:00:00.000Z')})
  const second=await cleanupNightFlightRuns({supabase,now:new Date('2026-09-18T12:00:00.000Z')})
  assert.equal(first.deletedRuns,1)
  assert.equal(second.deletedRuns,0)
  assert.deepEqual(supabase.state.runs,[])
})

test('F4 requires Supabase and rejects invalid time',async()=>{
  await assert.rejects(()=>cleanupNightFlightRuns({supabase:null}),/requires Supabase/)
  assert.throws(()=>nightFlightRetentionCutoffDate('not-a-date'),/time is invalid/)
})
