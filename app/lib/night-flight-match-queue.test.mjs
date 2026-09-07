import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule(){
  try{return await import('./night-flight-match-queue.js')}catch{return null}
}

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}

function fakeSupabase({jobs=[],runs=[]}={}){
  const state={jobs:clone(jobs),runs:clone(runs)}
  const calls=[]

  class Query{
    constructor(table){
      this.table=table
      this.filters=[]
      this.orderBy=null
      this.limitCount=null
      this.operation='select'
      this.payload=null
    }
    select(){return this}
    update(payload){this.operation='update';this.payload=clone(payload);return this}
    eq(field,value){this.filters.push(row=>String(row?.[field]??'')===String(value??''));return this}
    in(field,values){const allowed=new Set(values||[]);this.filters.push(row=>allowed.has(row?.[field]));return this}
    order(field,{ascending=true}={}){this.orderBy={field,ascending};return this}
    limit(count){this.limitCount=count;return this}
    rows(){
      const source=this.table==='night_flight_jobs'?state.jobs:state.runs
      let rows=source.filter(row=>this.filters.every(filter=>filter(row)))
      if(this.orderBy){
        const {field,ascending}=this.orderBy
        rows=[...rows].sort((a,b)=>String(a?.[field]??'').localeCompare(String(b?.[field]??''))*(ascending?1:-1))
      }
      if(Number.isFinite(this.limitCount)) rows=rows.slice(0,this.limitCount)
      return rows
    }
    execute(){
      if(this.operation==='update'){
        const rows=this.rows()
        for(const row of rows) Object.assign(row,clone(this.payload))
        calls.push({table:this.table,op:'update',payload:clone(this.payload),count:rows.length})
        return {data:clone(rows),error:null}
      }
      const rows=this.rows()
      calls.push({table:this.table,op:'select',count:rows.length})
      return {data:clone(rows),error:null}
    }
    async maybeSingle(){
      const result=this.execute()
      return {data:result.data?.[0]??null,error:result.error}
    }
    async single(){
      const result=this.execute()
      return {data:result.data?.[0]??null,error:result.error}
    }
    then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject)}
  }

  return {
    state,
    calls,
    from(table){return new Query(table)},
  }
}

function job(jobKey,status,{attempts=0,updatedAt='2026-09-05T01:30:00.000Z'}={}){
  return {
    run_id:'run-6',
    job_key:jobKey,
    source:'linkedin',
    job_snapshot:{jobId:`linkedin:${jobKey}`,title:`Role ${jobKey}`},
    area:'copenhagen_north',
    status,
    attempts,
    last_error:null,
    match_cache_key:null,
    processed_at:null,
    created_at:`2026-09-05T01:0${Math.min(attempts,9)}:00.000Z`,
    updated_at:updatedAt,
  }
}

function run(){
  return {
    id:'run-6',
    user_id:'user-6',
    target_date:'2026-09-04',
    status:'RUNNING',
    jobs_discovered:0,
    jobs_queued:0,
    jobs_ready:0,
    jobs_failed:0,
    jobs_skipped:0,
    completed_at:null,
    updated_at:'2026-09-05T01:00:00.000Z',
  }
}

test('Task 6 claims QUEUED work, increments attempts, and never claims terminal states',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const supabase=fakeSupabase({jobs:[
    job('ready','READY'),
    job('skipped','SKIPPED_AREA'),
    job('failed','FAILED',{attempts:3}),
    job('queued','QUEUED'),
  ],runs:[run()]})
  const now=new Date('2026-09-05T02:00:00.000Z')

  const claimed=await mod.claimNextNightFlightJob({supabase,runId:'run-6',now})

  assert.equal(claimed.job_key,'queued')
  assert.equal(claimed.status,'PROCESSING')
  assert.equal(claimed.attempts,1)
  assert.equal(claimed.updated_at,now.toISOString())
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='ready').status,'READY')
})

test('Task 6 keeps a fresh PROCESSING lease but reclaims an abandoned PROCESSING job',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const now=new Date('2026-09-05T02:00:00.000Z')
  const fresh=fakeSupabase({jobs:[job('fresh','PROCESSING',{attempts:1,updatedAt:'2026-09-05T01:50:00.000Z'})],runs:[run()]})
  const stale=fakeSupabase({jobs:[job('stale','PROCESSING',{attempts:1,updatedAt:'2026-09-05T01:30:00.000Z'})],runs:[run()]})

  assert.equal(await mod.claimNextNightFlightJob({supabase:fresh,runId:'run-6',now,leaseMs:15*60*1000}),null)
  const reclaimed=await mod.claimNextNightFlightJob({supabase:stale,runId:'run-6',now,leaseMs:15*60*1000})
  assert.equal(reclaimed.job_key,'stale')
  assert.equal(reclaimed.status,'PROCESSING')
  assert.equal(reclaimed.attempts,2,'a crashed PROCESSING attempt consumes retry budget when reclaimed')
  assert.equal(reclaimed.updated_at,now.toISOString())
})

test('Task 6 completes only the currently claimed lease and persists READY cache reference',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const supabase=fakeSupabase({jobs:[job('one','QUEUED')],runs:[run()]})
  const claimTime=new Date('2026-09-05T02:00:00.000Z')
  const doneTime=new Date('2026-09-05T02:00:12.000Z')
  const claimed=await mod.claimNextNightFlightJob({supabase,runId:'run-6',now:claimTime})

  const ready=await mod.completeNightFlightJob({supabase,claimedJob:claimed,matchCacheKey:'match-cache-6',now:doneTime})

  assert.equal(ready.status,'READY')
  assert.equal(ready.match_cache_key,'match-cache-6')
  assert.equal(ready.processed_at,doneTime.toISOString())
  assert.equal(ready.last_error,null)
})

test('Task 6 bounds automatic retries and exhausts them into FAILED',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const supabase=fakeSupabase({jobs:[job('bad','QUEUED')],runs:[run()]})

  let claimed=await mod.claimNextNightFlightJob({supabase,runId:'run-6',now:new Date('2026-09-05T02:00:00.000Z'),maxAttempts:3})
  let failed=await mod.failNightFlightJob({supabase,claimedJob:claimed,error:new Error('provider timeout'),maxAttempts:3,now:new Date('2026-09-05T02:00:05.000Z')})
  assert.equal(failed.status,'RETRY')
  assert.match(failed.last_error,/provider timeout/)

  claimed=await mod.claimNextNightFlightJob({supabase,runId:'run-6',now:new Date('2026-09-05T02:01:00.000Z'),maxAttempts:3})
  failed=await mod.failNightFlightJob({supabase,claimedJob:claimed,error:new Error('provider timeout'),maxAttempts:3,now:new Date('2026-09-05T02:01:05.000Z')})
  assert.equal(failed.status,'RETRY')

  claimed=await mod.claimNextNightFlightJob({supabase,runId:'run-6',now:new Date('2026-09-05T02:02:00.000Z'),maxAttempts:3})
  failed=await mod.failNightFlightJob({supabase,claimedJob:claimed,error:new Error('provider timeout'),maxAttempts:3,now:new Date('2026-09-05T02:02:05.000Z')})
  assert.equal(failed.status,'FAILED')
  assert.equal(failed.attempts,3)
  assert.equal(await mod.claimNextNightFlightJob({supabase,runId:'run-6',now:new Date('2026-09-05T02:03:00.000Z'),maxAttempts:3}),null)
})

test('Task 6 isolates one failing vacancy, resumes without READY repeats, and finalizes READY_WITH_ERRORS',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const supabase=fakeSupabase({jobs:[
    job('already-ready','READY'),
    job('bad','QUEUED'),
    job('good','QUEUED'),
    job('outside','SKIPPED_AREA'),
  ],runs:[run()]})
  const calls=[]
  let tick=0
  const now=()=>new Date(Date.parse('2026-09-05T02:00:00.000Z')+(tick++*1000))

  const result=await mod.processNightFlightQueue({
    supabase,
    runId:'run-6',
    maxAttempts:2,
    leaseMs:15*60*1000,
    now,
    processJob:async claimed=>{
      calls.push(claimed.job_key)
      if(claimed.job_key==='bad') throw new Error('bad vacancy')
      return {matchCacheKey:`cache:${claimed.job_key}`}
    },
  })

  assert.deepEqual(calls,['bad','good','bad'],'READY work is skipped and QUEUED work gets a turn before RETRY')
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='already-ready').attempts,0)
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='good').status,'READY')
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='bad').status,'FAILED')
  assert.equal(supabase.state.jobs.find(row=>row.job_key==='outside').status,'SKIPPED_AREA')
  assert.equal(result.status,'READY_WITH_ERRORS')
  assert.equal(result.jobsReady,2)
  assert.equal(result.jobsFailed,1)
  assert.equal(result.jobsSkipped,1)
  assert.equal(supabase.state.runs[0].status,'READY_WITH_ERRORS')
  assert.ok(supabase.state.runs[0].completed_at)
})

test('Task 6 finalizes READY when all in-scope persisted jobs are complete',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-match-queue.js must exist')
  const supabase=fakeSupabase({jobs:[job('one','QUEUED'),job('outside','SKIPPED_AREA')],runs:[run()]})

  const result=await mod.processNightFlightQueue({
    supabase,
    runId:'run-6',
    now:()=>new Date('2026-09-05T02:00:00.000Z'),
    processJob:async claimed=>({matchCacheKey:`cache:${claimed.job_key}`}),
  })

  assert.equal(result.status,'READY')
  assert.equal(result.jobsReady,1)
  assert.equal(result.jobsFailed,0)
  assert.equal(result.jobsSkipped,1)
})
