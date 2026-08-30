import test from 'node:test'
import assert from 'node:assert/strict'
import { searchLinkedInSource } from './linkedin-source-adapter.js'

test('profile mode delegates to discovery builder and acquisition without evaluation', async () => {
  const calls=[]
  const foundBy=[{role:'Delivery Manager',tier:'primary',query:'Delivery Manager'}]
  const result=await searchLinkedInSource({
    freshnessDays:7,
    unionSearchPlan:{directions:[{role:'Delivery Manager'}]},
    exclusionRules:[],
    dependencies:{
      buildDiscoverySearchPlan:async ({unionSearchPlan})=>{calls.push('build');return {...unionSearchPlan,expanded:true}},
      acquireLinkedInProfileJobs:async args=>{calls.push(args.unionSearchPlan.expanded?'acquire':'bad');return {jobs:[{sourceJobId:'1',title:'Delivery Manager',company:'Acme',location:'Copenhagen',description:'JD',foundBy}],coverage:{status:'SEARCHED'},stats:{found:1},audit:[]}},
      createLinkedInStableFetcher:()=>({kind:'fetcher'}),
    }
  })
  assert.deepEqual(calls,['build','acquire'])
  assert.equal(result.status,'success')
  assert.equal(result.jobs[0].sourceRecords[0].source,'linkedin')
  assert.deepEqual(result.jobs[0].foundBy,foundBy)
  assert.equal(result.jobs[0].legacyEvaluation,undefined)
})

test('legacy mode preserves existing evaluated result as compatibility bridge', async () => {
  let resume=''
  const evaluation={score:8.8,verdict:'Profile match',action:'Consider'}
  const result=await searchLinkedInSource({
    freshnessDays:3,
    unionSearchPlan:{directions:[]},
    cvText:'x'.repeat(120),
    dependencies:{
      searchLinkedInStable:async args=>{resume=args.resume;return {jobs:[{job:{sourceJobId:'2',title:'Project Manager'},evaluation}],coverage:{status:'SEARCHED'},stats:{found:1}}},
      createLinkedInStableFetcher:()=>({}),
    }
  })
  assert.equal(resume.length,120)
  assert.equal(result.jobs[0].sourceRecords[0].source,'linkedin')
  assert.deepEqual(result.jobs[0].legacyEvaluation,evaluation)
})

test('adapter returns failed status instead of throwing', async () => {
  const result=await searchLinkedInSource({
    unionSearchPlan:{directions:[]},cvText:'x'.repeat(120),
    dependencies:{searchLinkedInStable:async()=>{throw new Error('boom')},createLinkedInStableFetcher:()=>({})}
  })
  assert.equal(result.status,'failed')
  assert.equal(result.jobs.length,0)
})
