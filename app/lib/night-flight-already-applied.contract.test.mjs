import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {loadNightFlightIndex} from './night-flight-index.js'
import {loadNightFlightMorningReview} from './night-flight-review.js'

function chain(result){
  return {
    select(){return this},
    eq(){return this},
    in(){return this},
    order(){return this},
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject)},
  }
}

function fakeIndexSupabase({runs=[],jobs=[],cache=[]}={}){
  return {
    from(table){
      if(table==='night_flight_runs') return chain({data:runs,error:null})
      if(table==='night_flight_jobs') return chain({data:jobs,error:null})
      if(table==='expertise_match_cache') return chain({data:cache,error:null})
      throw new Error(`unexpected table ${table}`)
    },
  }
}

function fakeReviewSupabase({runs=[],jobs=[],cache=[]}={}){
  return {
    from(table){
      const filters={}
      const inFilters={}
      let orderField=''
      let ascending=true
      let limitValue=null
      const query={
        select(){return query},
        eq(field,value){filters[field]=value;return query},
        in(field,values){inFilters[field]=values;return query},
        order(field,options={}){orderField=field;ascending=options.ascending!==false;return query},
        limit(value){limitValue=value;return query},
        async maybeSingle(){
          let rows=table==='night_flight_runs'?runs:table==='night_flight_jobs'?jobs:cache
          rows=rows.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          if(orderField) rows=[...rows].sort((a,b)=>String(a[orderField]||'').localeCompare(String(b[orderField]||''))*(ascending?1:-1))
          if(limitValue!=null) rows=rows.slice(0,limitValue)
          return {data:rows[0]||null,error:null}
        },
        then(resolve,reject){
          let rows=table==='night_flight_runs'?runs:table==='night_flight_jobs'?jobs:cache
          rows=rows.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          rows=rows.filter(row=>Object.entries(inFilters).every(([field,values])=>values.includes(row[field])))
          if(orderField) rows=[...rows].sort((a,b)=>String(a[orderField]||'').localeCompare(String(b[orderField]||''))*(ascending?1:-1))
          if(limitValue!=null) rows=rows.slice(0,limitValue)
          return Promise.resolve({data:rows,error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

test('NF-AA-1 Night Flight index exposes persisted Already Applied marker as a separate boolean',async()=>{
  const supabase=fakeIndexSupabase({
    runs:[{id:'run-1',target_date:'2026-09-18'}],
    jobs:[
      {run_id:'run-1',job_key:'linkedin:applied',source:'linkedin',job_snapshot:{sourceJobId:'applied'},status:'READY',already_applied:true,match_cache_key:null,processed_at:'2026-09-18T01:00:00Z'},
      {run_id:'run-1',job_key:'linkedin:new',source:'linkedin',job_snapshot:{sourceJobId:'new'},status:'READY',already_applied:false,match_cache_key:null,processed_at:'2026-09-18T01:01:00Z'},
    ],
  })

  const result=await loadNightFlightIndex({supabase,userId:'user-1'})

  assert.equal(result.jobs['linkedin:applied'].alreadyApplied,true)
  assert.equal(result.jobs['linkedin:new'].alreadyApplied,false)
  assert.equal(result.jobs['linkedin:applied'].processed,true)
})

test('NF-AA-1 Morning Review exposes Already Applied without changing Night Flight processing status',async()=>{
  const supabase=fakeReviewSupabase({
    runs:[{
      id:'run-1',user_id:'user-1',target_date:'2026-09-18',status:'READY_WITH_ERRORS',
      jobs_discovered:2,jobs_ready:1,jobs_failed:1,jobs_skipped:0,
      completed_at:'2026-09-18T01:10:00Z',created_at:'2026-09-18T01:00:00Z',
    }],
    jobs:[
      {
        run_id:'run-1',job_key:'linkedin:applied',source:'linkedin',
        job_snapshot:{sourceJobId:'applied',title:'Applied role'},area:'copenhagen_north',
        status:'READY',already_applied:true,last_error:null,match_cache_key:null,
        processed_at:'2026-09-18T01:05:00Z',created_at:'2026-09-18T01:01:00Z',
      },
      {
        run_id:'run-1',job_key:'linkedin:new',source:'linkedin',
        job_snapshot:{sourceJobId:'new',title:'New role'},area:'copenhagen_north',
        status:'FAILED',already_applied:false,last_error:'Match failed',match_cache_key:null,
        processed_at:'2026-09-18T01:06:00Z',created_at:'2026-09-18T01:02:00Z',
      },
    ],
  })

  const review=await loadNightFlightMorningReview({supabase,userId:'user-1'})

  assert.equal(review.jobs[0].alreadyApplied,true)
  assert.equal(review.jobs[0].status,'READY')
  assert.equal(review.jobs[1].alreadyApplied,false)
  assert.equal(review.jobs[1].status,'FAILED')
})

test('NF-AA-1 Already Applied contract must not couple Night Flight to browser manual-status storage',async()=>{
  const [indexSource,reviewSource]=await Promise.all([
    readFile(new URL('./night-flight-index.js',import.meta.url),'utf8'),
    readFile(new URL('./night-flight-review.js',import.meta.url),'utf8'),
  ])
  const combined=indexSource+'\n'+reviewSource

  assert.doesNotMatch(combined,/job-statuses|JOB_STATUS_STORAGE_KEY|writeJobStatus|localStorage/)
})
