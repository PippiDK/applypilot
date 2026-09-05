import test from 'node:test'
import assert from 'node:assert/strict'
import {getOrCreateExpertiseMatch,logicalExpertiseJobKey,expertiseMatchCacheReference,EXPERTISE_MATCH_ENGINE_VERSION,resolveManualExpertiseMatch} from './expertise-match-server-cache.js'

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

const job={
  source:'linkedin',sourceJobId:'li-11',jobId:'linkedin:li-11',
  title:'Senior Project Manager',company:'Acme A/S',location:'Copenhagen',
  publishedAt:'2026-09-05T08:30:00.000Z',description:'A sufficiently complete job description for Match.',
}

const profileState={
  cv_text:'Current CV text '.repeat(8),
  cv_source_version:'cv-v7',
  profile_fingerprint:'profile-fingerprint-7',
}

test('Task 11 ordinary Manual Match reuses a valid Night Flight server cache with zero AI calls',async()=>{
  assert.equal(typeof resolveManualExpertiseMatch,'function')
  const logicalJobKey=logicalExpertiseJobKey(job)
  const cacheKey=expertiseMatchCacheReference({
    userId:'u1',logicalJobKey,profileFingerprint:profileState.profile_fingerprint,engineVersion:EXPERTISE_MATCH_ENGINE_VERSION,
  })
  const analysis={expertiseMatch:93,whyYouFit:['Delivery ownership'],expertiseGaps:[]}
  const supabase=fakeCacheSupabase([{
    cache_key:cacheKey,user_id:'u1',logical_job_key:logicalJobKey,
    profile_fingerprint:profileState.profile_fingerprint,engine_version:EXPERTISE_MATCH_ENGINE_VERSION,analysis,
  }])
  let aiCalls=0

  const result=await resolveManualExpertiseMatch({
    supabase,userId:'u1',job,cvText:profileState.cv_text,cvSourceVersion:'cv-v7',profileState,
    analyze:async()=>{aiCalls+=1;return {expertiseMatch:1}},
  })

  assert.equal(aiCalls,0)
  assert.equal(result.cacheHit,true)
  assert.equal(result.matchCacheKey,cacheKey)
  assert.deepEqual(result.analysis,analysis)
})

test('Task 11 ordinary Manual Match writes through the same server cache on a valid cache MISS',async()=>{
  assert.equal(typeof resolveManualExpertiseMatch,'function')
  const supabase=fakeCacheSupabase()
  let aiCalls=0
  const analyze=async()=>{aiCalls+=1;return {expertiseMatch:81}}
  const input={supabase,userId:'u1',job,cvText:profileState.cv_text,cvSourceVersion:'cv-v7',profileState,analyze}

  const first=await resolveManualExpertiseMatch(input)
  const second=await resolveManualExpertiseMatch(input)

  assert.equal(aiCalls,1)
  assert.equal(first.cacheHit,false)
  assert.equal(second.cacheHit,true)
  assert.equal(supabase.rows.length,1)
})

test('Task 11 preserves Manual Match when synchronized cache identity is stale instead of reusing the wrong cache',async()=>{
  assert.equal(typeof resolveManualExpertiseMatch,'function')
  const supabase=fakeCacheSupabase()
  let aiCalls=0
  const analysis={expertiseMatch:77}

  const result=await resolveManualExpertiseMatch({
    supabase,userId:'u1',job,cvText:'Different current CV '.repeat(8),cvSourceVersion:'cv-v8',profileState,
    analyze:async()=>{aiCalls+=1;return analysis},
  })

  assert.equal(aiCalls,1)
  assert.equal(result.cacheHit,false)
  assert.equal(result.matchCacheKey,null)
  assert.deepEqual(result.analysis,analysis)
  assert.equal(supabase.rows.length,0)
})
