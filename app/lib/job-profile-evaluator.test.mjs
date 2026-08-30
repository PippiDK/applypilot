import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateProfileJob } from './job-profile-evaluator.js'

const NOW=new Date('2026-08-30T12:00:00Z')

function baseJob(overrides={}){
  return {
    title:'Senior Project Manager',
    company:'Acme A/S',
    location:'Copenhagen, Denmark',
    country:'Denmark',
    description:'Lead project delivery across technology teams and stakeholders.',
    publishedAt:'2026-08-30T08:00:00Z',
    vacancyStatus:'OPEN',
    employmentType:'Full-time',
    remoteType:'Hybrid',
    ...overrides,
  }
}

const primary=[{role:'Senior Project Manager',tier:'primary'}]

test('preserves current exact primary role score and verdict',()=>{
  const result=evaluateProfileJob({job:baseJob(),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
  assert.equal(result.evaluation.score,9.6)
  assert.equal(result.evaluation.verdict,'Strong profile match')
  assert.equal(result.evaluation.action,'Consider')
  assert.equal(result.reason,'Matched primary Search Profile direction: Senior Project Manager')
})

test('rejects a vacancy outside freshness before role evaluation',()=>{
  const result=evaluateProfileJob({job:baseJob({publishedAt:'2026-08-20T08:00:00Z'}),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,false)
  assert.equal(result.stage,'FRESHNESS_REJECT')
  assert.equal(result.reason,'Vacancy is outside the selected 7-day window')
})

test('preserves deterministic Search Profile exclusion behavior',()=>{
  const result=evaluateProfileJob({
    job:baseJob({company:'Blocked Company'}),
    foundBy:primary,
    freshnessDays:7,
    now:NOW,
    exclusionRules:[{evaluation:'deterministic',operator:'exclude',category:'company',value:'Blocked Company',originalText:'Exclude Blocked Company'}],
  })
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_EXCLUSION_REJECT')
  assert.equal(result.reason,'Search Profile exclusion: Exclude Blocked Company')
})

test('rejects a role outside approved Search Profile directions',()=>{
  const result=evaluateProfileJob({job:baseJob({title:'Finance Controller',description:'Own month-end reporting and financial controls.'}),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_ROLE_REJECT')
  assert.equal(result.reason,'Vacancy does not confirm an approved Search Profile role direction')
})
