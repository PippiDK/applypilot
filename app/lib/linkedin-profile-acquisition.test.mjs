import test from 'node:test'
import assert from 'node:assert/strict'
import { acquireLinkedInProfileJobs } from './linkedin-profile-acquisition.js'

test('acquires full LinkedIn jobs without evaluating them',async()=>{
  const discovery={
    candidates:[{jobId:'123',foundBy:[{role:'Delivery Manager',tier:'primary'}],title:'Delivery Manager',company:'Acme'}],
    stats:{searchRequests:1,searchFailures:0},coverage:{status:'SEARCHED'}
  }
  const result=await acquireLinkedInProfileJobs({
    freshnessDays:7,
    unionSearchPlan:{directions:[{role:'Delivery Manager'}]},
    fetcher:async()=>'<html>detail</html>',
    dependencies:{
      searchLinkedInShadow:async()=>discovery,
      parseDetailHtml:(candidate)=>({sourceJobId:candidate.jobId,title:'Delivery Manager',company:'Acme',location:'Copenhagen',publishedAt:'2026-08-30',description:'Lead delivery',url:'https://linkedin.example/123'}),
    },
  })
  assert.equal(result.jobs.length,1)
  assert.deepEqual(result.jobs[0].foundBy,[{role:'Delivery Manager',tier:'primary'}])
  assert.equal(result.jobs[0].evaluation,undefined)
  assert.equal(result.jobs[0].description,'Lead delivery')
})

test('detail failure is reported without rejecting whole acquisition',async()=>{
  const result=await acquireLinkedInProfileJobs({
    unionSearchPlan:{directions:[{role:'Delivery Manager'}]},
    fetcher:async()=>{throw new Error('detail down')},
    dependencies:{
      searchLinkedInShadow:async()=>({candidates:[{jobId:'123',foundBy:[]}],stats:{searchFailures:0},coverage:{status:'SEARCHED'}}),
      parseDetailHtml:()=>null,
    },
  })
  assert.equal(result.jobs.length,0)
  assert.equal(result.stats.detailFailures,1)
  assert.equal(result.status,'partial')
})
