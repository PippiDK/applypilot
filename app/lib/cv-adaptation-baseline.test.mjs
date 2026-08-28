import test from 'node:test'
import assert from 'node:assert/strict'
import {buildAdaptationBaseline,baselineKey,baselineMatches} from './cv-adaptation-baseline.js'

const readyCv=(slot,overrides={})=>({
  id:`cv-${slot}`,
  slot,
  status:'ready',
  fileName:`CV-${slot}.pdf`,
  sourceVersion:`sha256:cv-${slot}-v1`,
  cvText:`CV ${slot} evidence `.repeat(20),
  summary:`Summary ${slot}`,
  facts:[{id:`F${slot}`,text:`Fact from CV ${slot}`,verified:true}],
  skills:[`Skill ${slot}`],
  ...overrides
})

const jobA={
  sourceJobId:'JOB-A',
  title:'Implementation Manager',
  company:'Example A/S',
  location:'Copenhagen',
  description:'Lead end-to-end implementation delivery, cutover and operational handover.'
}
const jobB={...jobA,sourceJobId:'JOB-B',company:'Example B A/S'}

test('builds one immutable vacancy-to-CV baseline from the selected CV only',()=>{
  const cv1=readyCv(1)
  const cv2=readyCv(2)
  const cv3=readyCv(3)
  const before2=structuredClone(cv2)
  const baseline=buildAdaptationBaseline({job:jobA,cv:cv2})

  assert.equal(baseline.jobId,'JOB-A')
  assert.equal(baseline.cvId,'cv-2')
  assert.equal(baseline.sourceVersion,'sha256:cv-2-v1')
  assert.equal(baseline.cvText,cv2.cvText)
  assert.deepEqual(baseline.facts,cv2.facts)
  assert.deepEqual(baseline.skills,cv2.skills)
  assert.equal(baseline.cvText.includes('CV 1 evidence'),false)
  assert.equal(baseline.cvText.includes('CV 3 evidence'),false)
  assert.equal(JSON.stringify(baseline).includes(cv1.sourceVersion),false)
  assert.equal(JSON.stringify(baseline).includes(cv3.sourceVersion),false)
  assert.deepEqual(cv2,before2)
  assert.notEqual(baseline.facts,cv2.facts)
  assert.notEqual(baseline.skills,cv2.skills)
})

test('baseline key is stable for the same vacancy and selected CV snapshot',()=>{
  const cv2=readyCv(2)
  const first=buildAdaptationBaseline({job:jobA,cv:cv2})
  const second=buildAdaptationBaseline({job:jobA,cv:cv2})
  assert.equal(baselineKey(first),baselineKey(second))
  assert.ok(first.jdFingerprint)
})

test('changing vacancy invalidates the old baseline',()=>{
  const cv2=readyCv(2)
  const baseline=buildAdaptationBaseline({job:jobA,cv:cv2})
  assert.equal(baselineMatches({baseline,job:jobA,cv:cv2}),true)
  assert.equal(baselineMatches({baseline,job:jobB,cv:cv2}),false)
  assert.equal(baselineMatches({baseline,job:{...jobA,description:'Different JD text'},cv:cv2}),false)
})

test('replacing the selected CV invalidates the old baseline when sourceVersion changes',()=>{
  const cv2=readyCv(2)
  const baseline=buildAdaptationBaseline({job:jobA,cv:cv2})
  const replaced=readyCv(2,{sourceVersion:'sha256:cv-2-v2',cvText:'Replacement CV 2 evidence '.repeat(20)})
  assert.equal(baselineMatches({baseline,job:jobA,cv:replaced}),false)
})

test('rejects an invalid vacancy or CV instead of fabricating a baseline',()=>{
  assert.throws(()=>buildAdaptationBaseline({job:{},cv:readyCv(1)}),/vacancy/i)
  assert.throws(()=>buildAdaptationBaseline({job:jobA,cv:{...readyCv(1),status:'needs-reupload'}}),/ready CV/i)
})
