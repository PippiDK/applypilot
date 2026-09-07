import test from 'node:test'
import assert from 'node:assert/strict'
import {requestExpertiseMatch} from './expertise-match-client.js'

const job={source:'linkedin',sourceJobId:'4445506698',jobId:'linkedin:4445506698',publishedAt:'2026-09-05T08:30:00.000Z',title:'Assoc Director AI Product Manager',company:'Novo Nordisk',location:'Ballerup',description:'A'.repeat(160)}
const cvText='Senior IT Project and Delivery Manager '.repeat(5)

test('requestExpertiseMatch sends selected full JD, active Source CV and stable job identity to the dedicated endpoint',async()=>{
  let seen
  const fetchImpl=async(url,options)=>{
    seen={url,method:options.method,body:JSON.parse(options.body)}
    return {ok:true,json:async()=>({analysis:{expertiseMatch:70,whyYouFit:[],expertiseGaps:[],breakdown:{},requirements:[]}})}
  }
  const result=await requestExpertiseMatch({job,cvText,fetchImpl})
  assert.equal(seen.url,'/api/expertise-match')
  assert.equal(seen.method,'POST')
  assert.deepEqual(seen.body.job,{title:job.title,company:job.company,location:job.location,description:job.description})
  assert.deepEqual(seen.body.jobIdentity,{source:job.source,sourceJobId:job.sourceJobId,jobId:job.jobId,publishedAt:job.publishedAt})
  assert.equal(seen.body.cvText,cvText.trim())
  assert.equal(result.expertiseMatch,70)
})

test('requestExpertiseMatch surfaces safe server errors',async()=>{
  const fetchImpl=async()=>({ok:false,json:async()=>({error:'Expertise Match analysis failed safely. Please try again.'})})
  await assert.rejects(()=>requestExpertiseMatch({job,cvText,fetchImpl}),/Expertise Match analysis failed safely/)
})
