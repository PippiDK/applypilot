import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadModule(){
  try{return await import('./night-flight-status.js')}catch{return null}
}

function fakeStatusSupabase({runs=[],jobs=[]}={}){
  const calls=[]
  return {
    calls,
    from(table){
      const filters={}
      let orderField=''
      let ascending=true
      let limitValue=null
      const query={
        select(fields){calls.push({table,op:'select',fields});return query},
        eq(field,value){filters[field]=value;return query},
        order(field,options={}){orderField=field;ascending=options.ascending!==false;return query},
        limit(value){limitValue=value;return query},
        async maybeSingle(){
          let rows=table==='night_flight_runs'?runs:jobs
          rows=rows.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          if(orderField) rows=[...rows].sort((a,b)=>String(a[orderField]||'').localeCompare(String(b[orderField]||''))*(ascending?1:-1))
          if(limitValue!=null) rows=rows.slice(0,limitValue)
          return {data:rows[0]||null,error:null}
        },
        then(resolve,reject){
          let rows=table==='night_flight_runs'?runs:jobs
          rows=rows.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
          if(orderField) rows=[...rows].sort((a,b)=>String(a[orderField]||'').localeCompare(String(b[orderField]||''))*(ascending?1:-1))
          if(limitValue!=null) rows=rows.slice(0,limitValue)
          return Promise.resolve({data:rows,error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

const run=(overrides={})=>({id:'run-latest',user_id:'u1',target_date:'2026-09-05',status:'RUNNING',...overrides})
const job=(key,status)=>({run_id:'run-latest',job_key:key,status})

test('Task 10 loads the latest run for only the authenticated user and computes lightweight progress from jobs',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-status.js must exist')
  const supabase=fakeStatusSupabase({
    runs:[run({id:'older',target_date:'2026-09-04'}),run(),run({id:'foreign',user_id:'u2',target_date:'2026-09-06'})],
    jobs:[job('r1','READY'),job('r2','READY'),job('f1','FAILED'),job('p1','PROCESSING'),job('skip','SKIPPED_AREA')],
  })
  const status=await mod.loadNightFlightStatus({supabase,userId:'u1'})
  assert.deepEqual(status,{
    run:{id:'run-latest',targetDate:'2026-09-05',status:'RUNNING'},
    progress:{ready:2,failed:1,total:4,remaining:1},
  })
})

test('Task 10 returns null without reading jobs when there is no Night Flight run',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-status.js must exist')
  const supabase=fakeStatusSupabase()
  const status=await mod.loadNightFlightStatus({supabase,userId:'u1'})
  assert.equal(status,null)
  assert.equal(supabase.calls.some(call=>call.table==='night_flight_jobs'),false)
})

test('Task 10 lightweight status read never touches Match cache or Match generation',async()=>{
  let source=''
  try{source=await readFile(new URL('./night-flight-status.js',import.meta.url),'utf8')}catch{}
  assert.doesNotMatch(source,/expertise_match_cache|analyzeExpertiseMatch|requestExpertiseMatch|getOrCreateExpertiseMatch/)
})
