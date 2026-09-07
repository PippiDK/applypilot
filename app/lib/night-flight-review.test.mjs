import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadModule(){
  try{return await import('./night-flight-review.js')}catch{return null}
}

function fakeReviewSupabase({runs=[],jobs=[],cache=[]}={}){
  const calls=[]
  return {
    calls,
    from(table){
      const filters={}
      const inFilters={}
      let orderField=''
      let ascending=true
      let limitValue=null
      const query={
        select(fields){calls.push({table,op:'select',fields});return query},
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

const run=(overrides={})=>({
  id:'run-latest',user_id:'u1',target_date:'2026-09-04',status:'READY_WITH_ERRORS',
  jobs_discovered:3,jobs_ready:1,jobs_failed:1,jobs_skipped:1,
  completed_at:'2026-09-05T02:10:00.000Z',created_at:'2026-09-05T02:00:00.000Z',...overrides,
})

const job=(key,status,overrides={})=>({
  run_id:'run-latest',job_key:key,source:'linkedin',
  job_snapshot:{sourceJobId:key,title:`Role ${key}`,company:'Acme',location:'Copenhagen'},
  area:'copenhagen_north',status,last_error:null,match_cache_key:null,
  processed_at:'2026-09-05T02:08:00.000Z',created_at:'2026-09-05T02:01:00.000Z',...overrides,
})

test('Task 9 loads the latest saved run for only the authenticated user',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-review.js must exist')
  const supabase=fakeReviewSupabase({runs:[
    run({id:'older',target_date:'2026-09-03'}),
    run(),
    run({id:'foreign',user_id:'u2',target_date:'2026-09-05'}),
  ]})
  const review=await mod.loadNightFlightMorningReview({supabase,userId:'u1'})
  assert.equal(review.run.id,'run-latest')
  assert.equal(review.run.targetDate,'2026-09-04')
  assert.equal(review.run.status,'READY_WITH_ERRORS')
})

test('Task 9 exposes saved batch, hides SKIPPED_AREA from primary review and hydrates READY from shared cache',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-review.js must exist')
  const analysis={whyYouFit:['Delivery leadership'],transferableStrengths:[],expertiseGaps:[],breakdown:{delivery_execution:{score:92}}}
  const supabase=fakeReviewSupabase({
    runs:[run()],
    jobs:[
      job('ready','READY',{match_cache_key:'cache-ready'}),
      job('failed','FAILED',{last_error:'Automatic Match failed'}),
      job('skip','SKIPPED_AREA'),
    ],
    cache:[{cache_key:'cache-ready',user_id:'u1',analysis}],
  })
  const review=await mod.loadNightFlightMorningReview({supabase,userId:'u1'})

  assert.deepEqual(review.counts,{ready:1,failed:1})
  assert.deepEqual(review.jobs.map(item=>item.key),['ready','failed'])
  assert.deepEqual(review.jobs[0].analysis,analysis)
  assert.equal(review.jobs[1].analysis,null)
  assert.equal(review.jobs[1].lastError,'Automatic Match failed')
  assert.equal(review.jobs.some(item=>item.status==='SKIPPED_AREA'),false)

  const cacheRead=supabase.calls.find(call=>call.table==='expertise_match_cache'&&call.op==='select')
  assert.ok(cacheRead,'READY Match must be loaded from the shared server cache')
})

test('Task 9 returns no review cleanly when the user has no saved Night Flight run',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-review.js must exist')
  const supabase=fakeReviewSupabase()
  const review=await mod.loadNightFlightMorningReview({supabase,userId:'u1'})
  assert.equal(review,null)
  assert.equal(supabase.calls.some(call=>call.table==='night_flight_jobs'),false)
  assert.equal(supabase.calls.some(call=>call.table==='expertise_match_cache'),false)
})

test('Task 9 Morning Review read-model never invokes the Match engine',async()=>{
  let source=''
  try{source=await readFile(new URL('./night-flight-review.js',import.meta.url),'utf8')}catch{}
  assert.doesNotMatch(source,/analyzeExpertiseMatch|requestExpertiseMatch|getOrCreateExpertiseMatch/)
})
