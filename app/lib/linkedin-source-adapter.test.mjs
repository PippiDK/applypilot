import test from 'node:test'
import assert from 'node:assert/strict'
import { searchLinkedInSource } from './linkedin-source-adapter.js'

test('profile mode delegates to existing discovery builder and profile search', async () => {
  const calls=[]
  const result=await searchLinkedInSource({
    freshnessDays:7,
    unionSearchPlan:{directions:[{role:'Delivery Manager'}]},
    exclusionRules:[],
    dependencies:{
      buildDiscoverySearchPlan:async ({unionSearchPlan})=>{calls.push('build');return {...unionSearchPlan,expanded:true}},
      searchLinkedInProfile:async args=>{calls.push(args.unionSearchPlan.expanded?'profile':'bad');return {jobs:[{sourceJobId:'1',title:'Delivery Manager',company:'Acme',location:'Copenhagen',fullJd:'JD'}],coverage:{status:'SEARCHED'},stats:{found:1},audit:[]}},
      createLinkedInStableFetcher:()=>({kind:'fetcher'}),
    }
  })
  assert.deepEqual(calls,['build','profile'])
  assert.equal(result.status,'success')
  assert.equal(result.jobs[0].sourceRecords[0].source,'linkedin')
})

test('legacy mode delegates to existing stable LinkedIn search', async () => {
  let resume=''
  const result=await searchLinkedInSource({
    freshnessDays:3,
    unionSearchPlan:{directions:[]},
    cvText:'x'.repeat(120),
    dependencies:{
      searchLinkedInStable:async args=>{resume=args.resume;return {jobs:[{sourceJobId:'2',title:'Project Manager'}],coverage:{status:'SEARCHED'},stats:{found:1}}},
      createLinkedInStableFetcher:()=>({}),
    }
  })
  assert.equal(resume.length,120)
  assert.equal(result.jobs[0].sourceRecords[0].source,'linkedin')
})

test('adapter returns failed status instead of throwing', async () => {
  const result=await searchLinkedInSource({
    unionSearchPlan:{directions:[]},cvText:'x'.repeat(120),
    dependencies:{searchLinkedInStable:async()=>{throw new Error('boom')},createLinkedInStableFetcher:()=>({})}
  })
  assert.equal(result.status,'failed')
  assert.equal(result.jobs.length,0)
})
