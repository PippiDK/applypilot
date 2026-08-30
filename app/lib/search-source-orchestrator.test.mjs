import test from 'node:test'
import assert from 'node:assert/strict'
import { runMultiSourceSearch } from './search-source-orchestrator.js'

const direction={role:'Senior Project Manager',tier:'primary',query:'Project Manager'}
const input={freshnessDays:7,unionSearchPlan:{directions:[direction]},exclusionRules:[],enabledSources:['linkedin','jobindex'],filters:{}}

function job(source,id,overrides={}){
  return {
    sourceJobId:id,
    jobId:`${source}:${id}`,
    title:'Senior Project Manager',company:'Acme A/S',location:'Copenhagen, Denmark',country:'Denmark',
    publishedAt:'2026-08-30T08:00:00Z',postedDate:'2026-08-30T08:00:00Z',
    description:'Lead project delivery across technology teams.',fullJd:'Lead project delivery across technology teams.',
    vacancyStatus:'OPEN',remoteType:'Hybrid',foundBy:[direction],
    applicationUrl:'https://acme.example/jobs/42',
    sourceRecords:[{source,sourceJobId:id,applicationUrl:'https://acme.example/jobs/42',fullJd:'Lead project delivery across technology teams.'}],
    ...overrides,
  }
}

test('runs both enabled sources, dedupes before one shared evaluation and keeps provenance',async()=>{
  let linkedinCalls=0,jobindexCalls=0
  const result=await runMultiSourceSearch(input,{
    linkedin:async()=>{linkedinCalls++;return {source:'linkedin',status:'success',jobs:[job('linkedin','1')],stats:{returned:1},audit:[]}},
    jobindex:async()=>{jobindexCalls++;return {source:'jobindex',status:'success',jobs:[job('jobindex','h1')],stats:{returned:1}}},
    now:new Date('2026-08-30T12:00:00Z'),
  })
  assert.equal(linkedinCalls,1)
  assert.equal(jobindexCalls,1)
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].evaluation.score,9.6)
  assert.equal(result.jobs[0].job.sourceRecords.length,2)
})

test('one failed source does not discard successful source results',async()=>{
  const result=await runMultiSourceSearch(input,{
    linkedin:async()=>{throw new Error('LinkedIn down')},
    jobindex:async()=>({source:'jobindex',status:'success',jobs:[job('jobindex','h2',{applicationUrl:'https://acme.example/jobs/43',sourceRecords:[{source:'jobindex',sourceJobId:'h2',applicationUrl:'https://acme.example/jobs/43'}]})],stats:{returned:1}}),
    now:new Date('2026-08-30T12:00:00Z'),
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.sourceStatuses.linkedin.status,'failed')
  assert.equal(result.sourceStatuses.jobindex.status,'success')
})

test('calls only selected source',async()=>{
  let linkedinCalls=0,jobindexCalls=0
  const result=await runMultiSourceSearch({...input,enabledSources:['jobindex']},{
    linkedin:async()=>{linkedinCalls++;return {source:'linkedin',status:'success',jobs:[]}},
    jobindex:async()=>{jobindexCalls++;return {source:'jobindex',status:'success',jobs:[],stats:{returned:0}}},
  })
  assert.equal(linkedinCalls,0)
  assert.equal(jobindexCalls,1)
  assert.equal(result.sourceStatuses.linkedin,undefined)
})

test('limited-data vacancy is retained without pretending it was fully evaluated',async()=>{
  const limited=job('jobindex','h3',{title:'',company:'',location:'',publishedAt:null,postedDate:null,description:'',fullJd:'',sourceRecords:[{source:'jobindex',sourceJobId:'h3',limitedData:true}]})
  const result=await runMultiSourceSearch({...input,enabledSources:['jobindex']},{
    jobindex:async()=>({source:'jobindex',status:'partial',jobs:[limited],stats:{returned:1}}),
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].evaluation,null)
  assert.equal(result.jobs[0].limitedData,true)
})
