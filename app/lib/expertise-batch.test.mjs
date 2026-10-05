import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeExpertiseBatch,packExpertiseBatchJobs} from './expertise-batch.js'

const cv='Led end-to-end delivery and stakeholder governance for enterprise software programmes.'

function job(jobKey,index){
  return {
    jobKey,
    job:{
      title:`Project Manager ${index}`,
      company:'Acme',
      description:`Lead end-to-end delivery for programme ${index}. Manage stakeholders and governance.`,
    },
  }
}

test('Expertise batch sends multiple vacancies through one structured model call',async()=>{
  const jobs=[job('j1',1),job('j2',2),job('j3',3)]
  let calls=0
  const result=await analyzeExpertiseBatch({
    jobs,
    cvText:cv,
    modelCall:async({input})=>{
      calls+=1
      assert.equal(input.sourceCv,cv)
      assert.equal(input.jobs.length,3)
      return {
        jobs:input.jobs.map(item=>({
          jobKey:item.jobKey,
          items:[{
            id:'delivery',
            capability:'End-to-end delivery',
            category:'delivery_execution',
            importance:'core',
            requirement:'Lead end-to-end delivery',
            minimumYears:0,
            jdEvidence:['Lead end-to-end delivery'],
            status:'MATCHED',
            cvEvidence:['Led end-to-end delivery'],
            reason:'Directly evidenced in the Source CV.',
          }],
        })),
      }
    },
  })

  assert.equal(calls,1)
  assert.equal(result.results.length,3)
  assert.equal(result.failures.length,0)
  assert.ok(result.results.every(item=>item.analysis.expertiseMatch===100))
})

test('Expertise batch packer uses the minimum number of batches within configured limits',()=>{
  const jobs=Array.from({length:10},(_,index)=>job(`j${index+1}`,index+1))
  assert.equal(packExpertiseBatchJobs(jobs,{maxJobs:24,maxInputChars:180000}).length,1)
  assert.equal(packExpertiseBatchJobs(jobs,{maxJobs:6,maxInputChars:180000}).length,2)
})
