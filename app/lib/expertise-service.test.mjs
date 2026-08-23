import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeExpertiseMatch} from './expertise-service.js'

const job={title:'Integration Programme Manager',company:'Example',description:'Lead end-to-end integration programmes. Proven experience delivering M&A integrations or large-scale business transformation programmes. Lead complex cross-functional projects and work with executive leadership.'}
const cvText='Senior IT Project and Delivery Manager. Accountable for full lifecycle execution over 3.5 years. Led distributed cross-functional teams and executive-level reporting across large enterprise transformation programmes.'

const onePass={items:[
  {id:'delivery',capability:'End-to-end integration programme delivery',category:'delivery_execution',importance:'core',requirement:'Lead end-to-end integration programmes',minimumYears:0,jdEvidence:['Lead end-to-end integration programmes.'],status:'MATCHED',cvEvidence:['Accountable for full lifecycle execution over 3.5 years.'],reason:'Equivalent delivery lifecycle evidence.'},
  {id:'transform',capability:'M&A integration or large-scale business transformation',category:'domain_functional_expertise',importance:'critical',requirement:'M&A integration or large-scale business transformation experience',minimumYears:0,jdEvidence:['Proven experience delivering M&A integrations or large-scale business transformation programmes.'],status:'MATCHED',cvEvidence:['large enterprise transformation programmes.'],reason:'The OR requirement is satisfied by transformation.'}
]}

test('uses exactly one semantic AI stage and deterministic code for final percentage',async()=>{
  const stages=[]
  const result=await analyzeExpertiseMatch({job,cvText,modelCall:async args=>{stages.push(args.stage);return structuredClone(onePass)}})
  assert.deepEqual(stages,['expertise_match_one_pass'])
  assert.equal(result.expertiseMatch,100)
})
