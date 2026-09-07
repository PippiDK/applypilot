import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadModule(){
  try{return await import('./expertise-match-server-cache.js')}catch{return null}
}

function fakeCacheSupabase(initial=[]){
  const rows=initial.map(row=>({...row}))
  return {
    rows,
    from(table){
      assert.equal(table,'expertise_match_cache')
      const filters={}
      const query={
        select(){return query},
        eq(field,value){filters[field]=value;return query},
        async maybeSingle(){
          const row=rows.find(item=>Object.entries(filters).every(([field,value])=>item[field]===value))||null
          return {data:row,error:null}
        },
        async upsert(payload){
          const index=rows.findIndex(item=>item.cache_key===payload.cache_key)
          if(index>=0) rows[index]={...rows[index],...payload}
          else rows.push({...payload})
          return {error:null}
        },
      }
      return query
    },
  }
}

const jobA={
  source:'linkedin',sourceJobId:'li-1',jobId:'linkedin:li-1',
  title:'Senior Project Manager',company:'Acme A/S',location:'Copenhagen',
  publishedAt:'2026-09-04T08:30:00.000Z',description:'Full job description',
}
const jobB={
  source:'jobindex',sourceJobId:'ji-9',jobId:'jobindex:ji-9',
  title:'Senior Project Manager',company:'Acme AS',location:'Copenhagen',
  publishedAt:'2026-09-04T17:10:00.000Z',description:'Same logical vacancy from another source',
}

test('Task 8 logical job identity is source-independent for the same vacancy',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'expertise-match-server-cache.js must exist')
  assert.equal(mod.logicalExpertiseJobKey(jobA),mod.logicalExpertiseJobKey(jobB))
})

test('Task 8 valid server cache HIT performs zero Match AI calls',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'expertise-match-server-cache.js must exist')
  const logicalJobKey=mod.logicalExpertiseJobKey(jobA)
  const cacheKey=mod.expertiseMatchCacheReference({
    userId:'u1',logicalJobKey,profileFingerprint:'profile-1',engineVersion:mod.EXPERTISE_MATCH_ENGINE_VERSION,
  })
  const analysis={score:91,label:'STRONG'}
  const supabase=fakeCacheSupabase([{
    cache_key:cacheKey,user_id:'u1',logical_job_key:logicalJobKey,
    profile_fingerprint:'profile-1',engine_version:mod.EXPERTISE_MATCH_ENGINE_VERSION,analysis,
  }])
  let aiCalls=0
  const result=await mod.getOrCreateExpertiseMatch({
    supabase,userId:'u1',job:jobA,profileFingerprint:'profile-1',cvText:'x'.repeat(80),
    analyze:async()=>{aiCalls+=1;return {score:1}},
  })
  assert.equal(aiCalls,0)
  assert.equal(result.cacheHit,true)
  assert.deepEqual(result.analysis,analysis)
  assert.equal(result.matchCacheKey,cacheKey)
})

test('Task 8 cache MISS calls the existing Match engine once, stores success, then reuses it',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'expertise-match-server-cache.js must exist')
  const supabase=fakeCacheSupabase()
  let aiCalls=0
  const analyze=async()=>{aiCalls+=1;return {score:84,label:'GOOD'}}
  const input={supabase,userId:'u1',job:jobA,profileFingerprint:'profile-1',cvText:'y'.repeat(80),analyze}
  const first=await mod.getOrCreateExpertiseMatch(input)
  const second=await mod.getOrCreateExpertiseMatch(input)
  assert.equal(aiCalls,1)
  assert.equal(first.cacheHit,false)
  assert.equal(second.cacheHit,true)
  assert.equal(supabase.rows.length,1)
  assert.equal(first.matchCacheKey,second.matchCacheKey)
})

test('Task 8 profile fingerprint or engine version change produces a cache MISS',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'expertise-match-server-cache.js must exist')
  const supabase=fakeCacheSupabase()
  let aiCalls=0
  const analyze=async()=>{aiCalls+=1;return {score:70+aiCalls}}
  await mod.getOrCreateExpertiseMatch({supabase,userId:'u1',job:jobA,profileFingerprint:'profile-1',cvText:'z'.repeat(80),engineVersion:'engine-v1',analyze})
  await mod.getOrCreateExpertiseMatch({supabase,userId:'u1',job:jobA,profileFingerprint:'profile-2',cvText:'z'.repeat(80),engineVersion:'engine-v1',analyze})
  await mod.getOrCreateExpertiseMatch({supabase,userId:'u1',job:jobA,profileFingerprint:'profile-2',cvText:'z'.repeat(80),engineVersion:'engine-v2',analyze})
  assert.equal(aiCalls,3)
  assert.equal(supabase.rows.length,3)
})

test('Task 8 failed Match calculation is never cached',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'expertise-match-server-cache.js must exist')
  const supabase=fakeCacheSupabase()
  await assert.rejects(()=>mod.getOrCreateExpertiseMatch({
    supabase,userId:'u1',job:jobA,profileFingerprint:'profile-1',cvText:'q'.repeat(80),
    analyze:async()=>{throw new Error('AI failed')},
  }),/AI failed/)
  assert.equal(supabase.rows.length,0)
})

test('Task 8 migration defines shared cache identity, RLS and durable CV snapshot',async()=>{
  let sql=''
  try{sql=await readFile(new URL('../../supabase/migrations/20260905_expertise_match_cache.sql',import.meta.url),'utf8')}catch{}
  assert.match(sql,/create\s+table\s+if\s+not\s+exists\s+public\.expertise_match_cache/i)
  for(const column of ['user_id','logical_job_key','profile_fingerprint','engine_version','analysis']) assert.match(sql,new RegExp(column,'i'))
  assert.match(sql,/unique\s*\(\s*user_id\s*,\s*logical_job_key\s*,\s*profile_fingerprint\s*,\s*engine_version\s*\)/i)
  assert.match(sql,/enable\s+row\s+level\s+security/i)
  assert.match(sql,/auth\.uid\(\)\s*=\s*user_id/i)
  assert.match(sql,/alter\s+table\s+public\.night_flight_runs[\s\S]*cv_text_snapshot\s+text/i)
})
