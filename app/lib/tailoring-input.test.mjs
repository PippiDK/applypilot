import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTailoringInput } from './tailoring-input.js'

const readyCv={
  status:'ready',
  fileName:'candidate.pdf',
  sourceVersion:'sha256:abc',
  cvText:'Senior delivery leader with enterprise platform experience. '.repeat(8),
  facts:[],
  skills:[]
}

const item={job:{
  sourceJobId:'JOB-1',
  title:'Integration Project Manager',
  company:'Example',
  location:'Denmark',
  description:'Lead complex systems integration and cross-functional delivery. '.repeat(4)
}}

test('uses the complete active Source CV and selected JD',()=>{
  const input=buildTailoringInput(readyCv,item)
  assert.equal(input.sourceCv.cvText,readyCv.cvText.trim())
  assert.equal(input.sourceCv.sourceVersion,'sha256:abc')
  assert.equal(input.job.sourceJobId,'JOB-1')
  assert.match(input.job.description,/systems integration/i)
})

test('refuses tailoring when Source CV is not ready',()=>{
  assert.throws(()=>buildTailoringInput({...readyCv,status:'needs-reupload'},item),/Please Upload Your CV/i)
})

test('refuses a vacancy without usable JD text',()=>{
  assert.throws(()=>buildTailoringInput(readyCv,{job:{title:'PM',description:''}}),/job description/i)
})

test('does not mutate Source CV or selected job',()=>{
  const cv=structuredClone(readyCv)
  const selected=structuredClone(item)
  const cvBefore=structuredClone(cv)
  const selectedBefore=structuredClone(selected)
  buildTailoringInput(cv,selected)
  assert.deepEqual(cv,cvBefore)
  assert.deepEqual(selected,selectedBefore)
})
