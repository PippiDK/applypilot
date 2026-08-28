import test from 'node:test'
import assert from 'node:assert/strict'
import {buildAdaptationBaseline} from './cv-adaptation-baseline.js'

async function load(){ return import('./cv-adaptation-input.js').catch(()=>({})) }

const cvText=`Professional Summary
Senior delivery leader with regulated enterprise experience.

Professional Experience
Senior Project Manager
Example A/S
Jun 2022 - Mar 2026
Led end-to-end platform delivery and customer readiness.
Managed budgets, risks, dependencies, and go-live.

Senior IT Delivery Manager
Example Bank
Nov 2019 - May 2022
Delivered regulated financial IT initiatives and reporting automation.
Led stakeholder governance and operational handover.`

const cv={id:'cv-2',slot:2,status:'ready',fileName:'CV2.pdf',sourceVersion:'sha256:cv2',cvText,summary:'Summary',facts:[{text:'verified CV2 fact'}],skills:['Delivery']}
const job={sourceJobId:'JOB-1',title:'Senior Delivery Lead',company:'Hiring Co',location:'Copenhagen',description:'Lead complex end-to-end technology delivery across business and engineering teams, manage senior stakeholders, risks, dependencies, release readiness, and operational handover.'}

test('buildAdaptationInput exposes exactly one selected CV and the current job',async()=>{
  const {buildAdaptationInput}=await load()
  assert.equal(typeof buildAdaptationInput,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  const input=buildAdaptationInput({baseline,job})
  assert.deepEqual(Object.keys(input).sort(),['job','sourceCv'])
  assert.deepEqual(input.sourceCv,{cvId:'cv-2',sourceVersion:'sha256:cv2',fileName:'CV2.pdf',cvText})
  assert.deepEqual(Object.keys(input.sourceCv).sort(),['cvId','cvText','fileName','sourceVersion'])
  assert.equal(JSON.stringify(input).includes('verified CV2 fact'),false)
  assert.equal(JSON.stringify(input).includes('CV1_SENTINEL'),false)
  assert.equal(JSON.stringify(input).includes('CV3_SENTINEL'),false)
})

test('buildAdaptationInput rejects a different vacancy instead of reusing the old baseline',async()=>{
  const {buildAdaptationInput}=await load()
  assert.equal(typeof buildAdaptationInput,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  assert.throws(()=>buildAdaptationInput({baseline,job:{...job,sourceJobId:'JOB-2'}}),/baseline|vacancy|job/i)
})
