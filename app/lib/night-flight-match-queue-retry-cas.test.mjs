import test from 'node:test'
import assert from 'node:assert/strict'
import {claimNextNightFlightJob} from './night-flight-match-queue.js'

function retrySupabase(){
  const stored={
    run_id:'run-task14',
    job_key:'linkedin:4461723855',
    source:'linkedin',
    job_snapshot:{title:'Task 14 retry'},
    area:'copenhagen_north',
    status:'RETRY',
    attempts:1,
    last_error:'TASK14 forced Match failure',
    match_cache_key:null,
    processed_at:null,
    created_at:'2026-09-06T06:16:16.000Z',
    updated_at:'2026-09-06T06:26:33.208Z',
  }

  class Query{
    constructor(){this.filters=[];this.operation='select';this.payload=null}
    select(){return this}
    update(payload){this.operation='update';this.payload=payload;return this}
    eq(field,value){this.filters.push({field,value});return this}
    in(field,values){this.filters.push({field,values});return this}
    order(){return this}
    matches(){
      return this.filters.every(filter=>{
        if(filter.values) return filter.values.includes(stored[filter.field])
        return String(stored[filter.field]??'')===String(filter.value??'')
      })
    }
    wireRow(){
      if(!this.matches()) return null
      const row={...stored}
      // Integration regression: PostgREST can return an equivalent timestamptz
      // using a different textual representation across requests.
      row.updated_at='2026-09-06 06:26:33.208+00:00'
      return row
    }
    execute(){
      if(this.operation==='update'){
        if(!this.matches()) return {data:[],error:null}
        Object.assign(stored,this.payload)
        return {data:[this.wireRow()||{...stored}],error:null}
      }
      const row=this.wireRow()
      return {data:row?[row]:[],error:null}
    }
    async maybeSingle(){const result=this.execute();return {data:result.data[0]??null,error:result.error}}
    then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject)}
  }

  return {stored,from(){return new Query()}}
}

test('Task 14 integration: RETRY reclaim does not depend on timestamptz wire formatting',async()=>{
  const supabase=retrySupabase()
  const claimed=await claimNextNightFlightJob({
    supabase,
    runId:'run-task14',
    now:new Date('2026-09-06T06:30:00.000Z'),
    maxAttempts:3,
  })

  assert.ok(claimed,'RETRY row must remain reclaimable across HTTP requests')
  assert.equal(claimed.status,'PROCESSING')
  assert.equal(claimed.attempts,2)
  assert.equal(supabase.stored.status,'PROCESSING')
  assert.equal(supabase.stored.attempts,2)
})
