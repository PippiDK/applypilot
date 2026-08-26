import test from 'node:test'
import assert from 'node:assert/strict'
import {requestBestCv} from './best-cv-client.js'

const job={sourceJobId:'job-1',title:'Senior Delivery Manager',company:'Acme',location:'Copenhagen',description:'Full job description '.repeat(12)}
const cvs=[
  {id:'cv-1',slot:1,fileName:'one.pdf',sourceVersion:'v1',cvText:'Senior delivery manager '.repeat(10),summary:'Delivery',skills:['Jira']},
  {id:'cv-2',slot:2,fileName:'two.pdf',sourceVersion:'v2',cvText:'Enterprise project manager '.repeat(10),summary:'Enterprise',skills:['Governance']}
]

test('requestBestCv sends one request containing the Full JD and all candidate CV records',async()=>{
  let calls=0,seen
  const fetchImpl=async(url,options)=>{
    calls++
    seen={url,method:options.method,body:JSON.parse(options.body)}
    return {ok:true,json:async()=>({analysis:{recommendedCvId:'cv-2',rankedCvIds:['cv-2','cv-1'],reason:'Best positioned.',recommendation:'use_as_is',updateFocus:[],selectorVersion:'best-cv-selector-v1'}})}
  }
  const result=await requestBestCv({job,cvs,fetchImpl})
  assert.equal(calls,1)
  assert.equal(seen.url,'/api/best-cv')
  assert.equal(seen.method,'POST')
  assert.equal(seen.body.job.description,job.description.trim())
  assert.equal(seen.body.cvs.length,2)
  assert.deepEqual(seen.body.cvs.map(cv=>cv.id),['cv-1','cv-2'])
  assert.equal(result.recommendedCvId,'cv-2')
})

test('requestBestCv surfaces safe server errors',async()=>{
  const fetchImpl=async()=>({ok:false,json:async()=>({error:'Best CV analysis failed safely. Please try again.'})})
  await assert.rejects(()=>requestBestCv({job,cvs,fetchImpl}),/Best CV analysis failed safely/i)
})
