import test from 'node:test'
import assert from 'node:assert/strict'
import {readyAdaptationChoices,selectAdaptationCv,selectedAdaptationCv} from './cv-adaptation-selection.js'

const ready=(slot)=>({
  id:`cv-${slot}`,
  slot,
  status:'ready',
  fileName:`CV-${slot}.pdf`,
  sourceVersion:`sha256:${slot}`,
  cvText:`CV ${slot} `.repeat(30)
})

const library={cvs:[ready(1),ready(2),{...ready(3),status:'needs-reupload'}]}

test('returns only ready CVs and preserves stable cv-N ids',()=>{
  const choices=readyAdaptationChoices(library)
  assert.deepEqual(choices.map(cv=>cv.id),['cv-1','cv-2'])
  assert.deepEqual(choices.map(cv=>cv.slot),[1,2])
})

test('allows any ready CV to be selected for a job',()=>{
  const choices=readyAdaptationChoices({cvs:[ready(1),ready(2),ready(3)]})
  const next=selectAdaptationCv({}, {jobKey:'JOB-1',cvId:'cv-3',readyCvs:choices})
  assert.equal(selectedAdaptationCv(next,'JOB-1',choices)?.id,'cv-3')
})

test('refuses a CV that is missing or not ready',()=>{
  const choices=readyAdaptationChoices(library)
  assert.throws(()=>selectAdaptationCv({}, {jobKey:'JOB-1',cvId:'cv-3',readyCvs:choices}),/not ready/i)
  assert.throws(()=>selectAdaptationCv({}, {jobKey:'JOB-1',cvId:'cv-9',readyCvs:choices}),/not ready/i)
})

test('Best CV recommendation does not auto-select a CV',()=>{
  const choices=readyAdaptationChoices({cvs:[ready(1),ready(2),ready(3)]})
  const recommendedCvId='cv-2'
  const selections={}
  assert.equal(recommendedCvId,'cv-2')
  assert.equal(selectedAdaptationCv(selections,'JOB-1',choices),null)
})

test('user selection remains independent from the recommended CV',()=>{
  const choices=readyAdaptationChoices({cvs:[ready(1),ready(2),ready(3)]})
  const recommendedCvId='cv-2'
  const selections=selectAdaptationCv({}, {jobKey:'JOB-1',cvId:'cv-1',readyCvs:choices})
  const selected=selectedAdaptationCv(selections,'JOB-1',choices)
  assert.equal(recommendedCvId,'cv-2')
  assert.equal(selected?.id,'cv-1')
  assert.notEqual(selected?.id,recommendedCvId)
})
