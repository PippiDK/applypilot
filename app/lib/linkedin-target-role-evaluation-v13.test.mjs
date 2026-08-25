import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateJob } from './linkedin-search.js'

const resume=`Senior IT delivery and project management leader with enterprise software, data, integration, cloud, governance, risks, dependencies, implementation, migration, release, go-live and stakeholder management experience across regulated international environments. `.repeat(3)

function baseJob(title,description){
  return {
    title,
    description,
    fullJdVerified:true,
    vacancyStatus:'ACTIVE VIA THIRD PARTY',
    remoteType:'unknown',
    remoteEligibility:'UNVERIFIED',
    employmentType:'unknown',
    salaryMinDkkMonth:null,
    salaryMaxDkkMonth:null,
    location:'Copenhagen, Denmark',
    country:'Denmark',
  }
}

test('explicit Delivery Manager title is evaluated instead of hard-rejected when JD wording yields zero responsibility categories',()=>{
  const result=evaluateJob(baseJob(
    'Delivery Manager',
    'Maintain customer relationships, follow service commitments, communicate progress, and support successful customer deliveries across several accounts.'
  ),resume)
  assert.equal(result.hardExclusion,false)
  assert.notEqual(result.score,0)
})

test('ambiguous title with the same weak ownership evidence still receives the zero-ownership hard exclusion',()=>{
  const result=evaluateJob(baseJob(
    'Service Operations Lead',
    'Maintain customer relationships, follow service commitments, communicate progress, and support successful customer deliveries across several accounts.'
  ),resume)
  assert.equal(result.hardExclusion,true)
  assert.match(result.gaps[0],/No meaningful delivery ownership/i)
})
