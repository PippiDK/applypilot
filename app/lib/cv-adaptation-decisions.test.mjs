import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADAPTATION_DECISION,
  adaptationDecisionKey,
  readAdaptationDecision,
  setAdaptationDecision,
  safeAdaptationReviewBlocks
} from './cv-adaptation-decisions.js'

const baselineA={jobId:'JOB-A',cvId:'cv-1',sourceVersion:'sha256:v1'}
const baselineB={jobId:'JOB-B',cvId:'cv-1',sourceVersion:'sha256:v1'}

function identity(baseline,blockId){
  return {...baseline,blockId}
}

test('decision key binds job, CV, source version and block independently',()=>{
  const summary=identity(baselineA,'professional_summary')
  const latest=identity(baselineA,'latest_role_overview')
  assert.notEqual(adaptationDecisionKey(summary),adaptationDecisionKey(latest))

  let decisions={}
  decisions=setAdaptationDecision(decisions,summary,ADAPTATION_DECISION.ACCEPTED)
  decisions=setAdaptationDecision(decisions,latest,ADAPTATION_DECISION.ORIGINAL)

  assert.equal(readAdaptationDecision(decisions,summary),ADAPTATION_DECISION.ACCEPTED)
  assert.equal(readAdaptationDecision(decisions,latest),ADAPTATION_DECISION.ORIGINAL)
})

test('CV1 decisions never apply to CV2',()=>{
  const cv1=identity(baselineA,'professional_summary')
  const cv2={...cv1,cvId:'cv-2'}
  const decisions=setAdaptationDecision({},cv1,ADAPTATION_DECISION.ACCEPTED)
  assert.equal(readAdaptationDecision(decisions,cv1),ADAPTATION_DECISION.ACCEPTED)
  assert.equal(readAdaptationDecision(decisions,cv2),null)
})

test('vacancy A decisions never apply to vacancy B',()=>{
  const jobA=identity(baselineA,'professional_summary')
  const jobB=identity(baselineB,'professional_summary')
  const decisions=setAdaptationDecision({},jobA,ADAPTATION_DECISION.ACCEPTED)
  assert.equal(readAdaptationDecision(decisions,jobA),ADAPTATION_DECISION.ACCEPTED)
  assert.equal(readAdaptationDecision(decisions,jobB),null)
})

test('a new sourceVersion cannot see stale decisions',()=>{
  const oldIdentity=identity(baselineA,'previous_role_overview')
  const replacedCv={...oldIdentity,sourceVersion:'sha256:v2'}
  const decisions=setAdaptationDecision({},oldIdentity,ADAPTATION_DECISION.ORIGINAL)
  assert.equal(readAdaptationDecision(decisions,replacedCv),null)
})

test('Accept and Keep return new decision state without mutating the previous state',()=>{
  const originalState=Object.freeze({existing:'untouched'})
  const accepted=setAdaptationDecision(originalState,identity(baselineA,'professional_summary'),ADAPTATION_DECISION.ACCEPTED)
  const kept=setAdaptationDecision(accepted,identity(baselineA,'latest_role_overview'),ADAPTATION_DECISION.ORIGINAL)

  assert.deepEqual(originalState,{existing:'untouched'})
  assert.equal(originalState[adaptationDecisionKey(identity(baselineA,'professional_summary'))],undefined)
  assert.notEqual(accepted,originalState)
  assert.notEqual(kept,accepted)
})

test('only original or accepted are valid decision values',()=>{
  assert.throws(
    ()=>setAdaptationDecision({},identity(baselineA,'professional_summary'),'accept'),
    /original or accepted/i
  )
})

test('review exposes only generated Truth-Guard PASS blocks and uses safeText as UPDATED',()=>{
  const blocks={
    professionalSummary:{blockId:'professional_summary',status:'generated',originalText:'Original summary',tailoredText:'Unsafe draft summary',why:'Focus the summary on delivery.'},
    latestRoleOverview:{blockId:'latest_role_overview',status:'generated',originalText:'Original latest role',tailoredText:'Unsafe latest role draft',why:'Emphasise programme delivery.'},
    previousRoleOverview:{blockId:'previous_role_overview',status:'unavailable',originalText:'Original previous role',tailoredText:'',why:'Unavailable'}
  }
  const truthGuard={
    professionalSummary:{blockId:'professional_summary',verdict:'PASS',issues:[],safeText:'Truth-Guard safe summary'},
    latestRoleOverview:{blockId:'latest_role_overview',verdict:'FAIL',issues:[{code:'OVERCLAIM',claim:'ownership'}],safeText:'Original latest role'},
    previousRoleOverview:{blockId:'previous_role_overview',verdict:'PASS',issues:[],safeText:'Original previous role'}
  }

  const review=safeAdaptationReviewBlocks({blocks,truthGuard})
  assert.deepEqual(review.map(item=>item.blockId),['professional_summary'])
  assert.equal(review[0].updated,'Truth-Guard safe summary')
  assert.equal(review[0].original,'Original summary')
  assert.equal(review[0].why,'Focus the summary on delivery.')
  assert.notEqual(review[0].updated,blocks.professionalSummary.tailoredText)
})
