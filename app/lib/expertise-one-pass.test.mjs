import test from 'node:test'
import assert from 'node:assert/strict'
import {EXPERTISE_ONE_PASS_INSTRUCTIONS,evaluateExpertiseOnePass} from './expertise-one-pass.js'

const job={
  title:'Integration Programme Manager',
  company:'Example',
  description:'Lead end-to-end integration programmes. Proven experience delivering M&A integrations or large-scale business transformation programmes. Lead complex cross-functional projects and work with executive leadership.'
}
const cv='Senior IT Project and Delivery Manager. Accountable for full lifecycle execution over 3.5 years. Led distributed cross-functional teams and executive-level reporting across large enterprise transformation programmes.'

const result={items:[
  {id:'delivery',capability:'End-to-end integration programme delivery',category:'delivery_execution',importance:'core',requirement:'Lead end-to-end integration programmes',minimumYears:0,jdEvidence:['Lead end-to-end integration programmes.'],status:'MATCHED',cvEvidence:['Accountable for full lifecycle execution over 3.5 years.'],reason:'Full lifecycle execution directly evidences end-to-end delivery.'},
  {id:'transform',capability:'M&A integration or large-scale business transformation',category:'domain_functional_expertise',importance:'critical',requirement:'M&A integration or large-scale business transformation experience',minimumYears:0,jdEvidence:['Proven experience delivering M&A integrations or large-scale business transformation programmes.'],status:'MATCHED',cvEvidence:['large enterprise transformation programmes.'],reason:'The OR requirement is satisfied by the business transformation branch.'}
]}

test('evaluates JD and Source CV in one AI call and returns deterministic-score inputs',async()=>{
  let calls=0,captured
  const out=await evaluateExpertiseOnePass(job,cv,async args=>{calls++;captured=args;return structuredClone(result)})
  assert.equal(calls,1)
  assert.equal(captured.stage,'expertise_match_one_pass')
  assert.equal(captured.input.jobDescription,job.description)
  assert.equal(captured.input.sourceCv,cv)
  assert.equal(out.requirements.length,2)
  assert.equal(out.evaluations[1].status,'MATCHED')
})

test('prompt requires atomic split of generic delivery from specialist campaign or production context',()=>{
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/atomic/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/end-to-end delivery/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/campaign/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/production/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/separate/i)
})

test('rejects invented CV evidence',async()=>{
  const bad=structuredClone(result)
  bad.items[0].cvEvidence=['Led five M&A acquisitions across Europe.']
  await assert.rejects(()=>evaluateExpertiseOnePass(job,cv,async()=>bad),/Source CV/i)
})

test('rejects requirement evidence not grounded in the JD',async()=>{
  const bad=structuredClone(result)
  bad.items[0].jdEvidence=['Must be a certified astronaut.']
  await assert.rejects(()=>evaluateExpertiseOnePass(job,cv,async()=>bad),/job description|JD evidence/i)
})

test('allows harmless punctuation differences in verbatim CV evidence',async()=>{
  const punctuated=structuredClone(result)
  punctuated.items[0].cvEvidence=['Accountable for full lifecycle execution over 3.5 years,']
  const out=await evaluateExpertiseOnePass(job,cv,async()=>punctuated)
  assert.equal(out.evaluations[0].status,'MATCHED')
})
