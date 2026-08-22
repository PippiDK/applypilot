import test from 'node:test'
import assert from 'node:assert/strict'
import {requestJobAnalysis} from './jd-analysis-client.js'

test('requestJobAnalysis sends active Source CV version plus selected full JD to analyze_job', async()=>{
  let seen=null
  const fakeFetch=async(url,options)=>{
    seen={url,options,body:JSON.parse(options.body)}
    return {ok:true,json:async()=>({stage:'job_analyzed',analysis:{roleMission:'Lead AI portfolio',candidatePositioning:'AI transformation leader',priorities:[{id:'p1',rank:1,kind:'must_have',requirement:'Own AI portfolio',why:'Core accountability',jdEvidence:['Manage a portfolio of high-impact AI and analytics initiatives.']},{id:'p2',rank:2,kind:'important',requirement:'Partner with senior leaders',why:'Advisory role',jdEvidence:['Act as a trusted advisor and subject matter expert to senior business leadership']},{id:'p3',rank:3,kind:'important',requirement:'Drive adoption',why:'Value realization',jdEvidence:['Ensure solutions are operationalized and embedded into business processes.']}],gapsToAvoid:[]},token:'signed'})}
  }
  const job={title:'AI Product Manager',company:'Example',location:'Ballerup',description:'A'.repeat(120)}
  const result=await requestJobAnalysis({sourceVersion:'sha256:abc',job,fetchImpl:fakeFetch})
  assert.equal(seen.url,'/api/tailor-cv')
  assert.equal(seen.options.method,'POST')
  assert.equal(seen.body.action,'analyze_job')
  assert.equal(seen.body.sourceVersion,'sha256:abc')
  assert.deepEqual(seen.body.job,job)
  assert.equal(result.stage,'job_analyzed')
  assert.equal(result.analysis.roleMission,'Lead AI portfolio')
})

test('requestJobAnalysis surfaces safe API errors', async()=>{
  const fakeFetch=async()=>({ok:false,json:async()=>({error:'Insufficient job description for safe tailoring.'})})
  await assert.rejects(()=>requestJobAnalysis({sourceVersion:'sha256:abc',job:{title:'X',description:'short'},fetchImpl:fakeFetch}),/Insufficient job description/)
})
