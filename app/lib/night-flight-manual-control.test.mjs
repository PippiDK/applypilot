import test from 'node:test'
import assert from 'node:assert/strict'
import {executeManualNightFlight,listManualNightFlights,ManualNightFlightError} from './night-flight-manual-control.js'

const RUN='11111111-1111-4111-8111-111111111111'
const OTHER='22222222-2222-4222-8222-222222222222'
const initialStamp='2026-09-24T00:00:00.000Z'
const clone=x=>JSON.parse(JSON.stringify(x))
function fixture({failReset=false}={}){
  const state={
    runs:[{id:RUN,user_id:'u1',target_date:'2026-09-23',status:'RUNNING',jobs_ready:1,jobs_failed:1},
      {id:OTHER,user_id:'u2',target_date:'2026-09-24',status:'RUNNING'}],
    jobs:[{run_id:RUN,job_key:'failed',status:'FAILED',attempts:1,updated_at:initialStamp,last_error:'AI_EXPERTISE_VALIDATION',job_snapshot:{title:'Role',company:'Acme',description:'PRIVATE-JD'}},
      {run_id:RUN,job_key:'ready',status:'READY',attempts:1,updated_at:initialStamp,last_error:null,match_cache_key:'cached',job_snapshot:{title:'Ready',company:'Acme'}},
      {run_id:RUN,job_key:'pending',status:'QUEUED',attempts:0,updated_at:initialStamp,last_error:null,job_snapshot:{title:'Pending',company:'Acme'}},
      {run_id:OTHER,job_key:'foreign',status:'FAILED',attempts:1,updated_at:initialStamp,job_snapshot:{title:'Foreign'}}],
  }
  class Query{
    constructor(table){this.table=table;this.filters=[];this.action='read';this.payload=null;this.count=null;this.orderField=null}
    select(){return this}
    eq(k,v){this.filters.push(row=>String(row[k])===String(v));return this}
    in(k,vs){this.filters.push(row=>vs.includes(row[k]));return this}
    order(field){this.orderField=field;return this}
    limit(n){this.count=n;return this}
    update(payload){this.action='update';this.payload=payload;return this}
    read(){
      let rows=state[this.table==='night_flight_runs'?'runs':'jobs'].filter(row=>this.filters.every(fn=>fn(row)))
      if(this.orderField) rows=[...rows].sort((a,b)=>String(b[this.orderField]).localeCompare(String(a[this.orderField])))
      if(this.count!=null) rows=rows.slice(0,this.count)
      if(this.action==='update'){
        if(failReset) return {data:[],error:null}
        for(const row of rows) Object.assign(row,clone(this.payload))
      }
      return {data:clone(rows),error:null}
    }
    async maybeSingle(){const {data,error}=this.read();return {data:data[0]??null,error}}
    then(resolve,reject){return Promise.resolve(this.read()).then(resolve,reject)}
  }
  return {state,from(table){return new Query(table)}}
}

test('manual start ignores the scheduler time gate but reuses its per-user runner',async()=>{
  const supabase=fixture()
  let call
  const result=await executeManualNightFlight({supabase,userId:'u1',mode:'start',
    now:new Date('2026-09-24T23:30:00Z'),
    startRun:async input=>{call=input;return {runId:RUN,targetDate:'2026-09-23',resumed:true,status:'RUNNING',jobsReady:1}}})
  assert.equal(call.userId,'u1')
  assert.equal(result.resumed,true)
  assert.equal(result.runId,RUN)
})

test('manual resume only permits an owned existing run, no discovery',async()=>{
  const supabase=fixture()
  let processed
  const result=await executeManualNightFlight({supabase,userId:'u1',mode:'resume',runId:RUN,
    processMatches:async input=>{processed=input;return {status:'RUNNING',jobsReady:1}}})
  assert.equal(processed.runId,RUN)
  assert.equal(processed.onlyJobKey,undefined)
  assert.equal(result.status,'RUNNING')
  await assert.rejects(executeManualNightFlight({supabase,userId:'u1',mode:'resume',runId:OTHER}),error=>error instanceof ManualNightFlightError&&error.status===404)
  await assert.rejects(executeManualNightFlight({supabase,userId:'u1',mode:'resume',runId:'not-uuid'}),error=>error.status===400)
})

test('retry resets and processes only one FAILED job, preserves READY and QUEUED',async()=>{
  const supabase=fixture()
  let processed
  const result=await executeManualNightFlight({supabase,userId:'u1',mode:'retry',runId:RUN,jobKey:'failed',
    now:new Date('2026-09-25T00:30:00Z'),
    processMatches:async input=>{processed=input;return {status:'RUNNING',jobsReady:1,jobsFailed:0}}})
  assert.equal(processed.onlyJobKey,'failed')
  assert.equal(result.jobKey,'failed')
  const failed=supabase.state.jobs.find(j=>j.job_key==='failed')
  assert.equal(failed.status,'QUEUED')
  assert.equal(failed.attempts,0)
  assert.equal(failed.last_error,null)
  assert.equal(supabase.state.jobs.find(j=>j.job_key==='ready').status,'READY')
  assert.equal(supabase.state.jobs.find(j=>j.job_key==='ready').match_cache_key,'cached')
  assert.equal(supabase.state.jobs.find(j=>j.job_key==='pending').status,'QUEUED')
})

test('retry rejects READY and foreign job and detects CAS conflict',async()=>{
  const supabase=fixture()
  await assert.rejects(executeManualNightFlight({supabase,userId:'u1',mode:'retry',runId:RUN,jobKey:'ready'}),error=>error.status===409)
  await assert.rejects(executeManualNightFlight({supabase,userId:'u1',mode:'retry',runId:OTHER,jobKey:'foreign'}),error=>error.status===404)
  await assert.rejects(executeManualNightFlight({supabase:fixture({failReset:true}),userId:'u1',mode:'retry',runId:RUN,jobKey:'failed'}),error=>error.status===409)
})

test('list returns only owned runs, never frozen CV or JD',async()=>{
  const result=await listManualNightFlights({supabase:fixture(),userId:'u1'})
  assert.equal(result.runs.length,1)
  assert.equal(result.runs[0].jobs.length,3)
  assert.equal(result.runs[0].jobs[0].title,'Role')
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-JD|cv_text_snapshot|foreign/)
})
