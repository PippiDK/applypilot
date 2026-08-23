import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeExpertiseMatch} from './expertise-service.js'

const job={title:'Integration Programme Manager',company:'Example',description:'Lead end-to-end integration programmes. Proven experience delivering M&A integrations or large-scale business transformation programmes. Lead complex cross-functional projects and work with executive leadership.'}
const cvText='Senior IT Project and Delivery Manager. Accountable for full lifecycle execution over 3.5 years. Led distributed cross-functional teams and executive-level reporting across large enterprise transformation programmes.'

const requirements={requirements:[
  {id:'delivery',capability:'End-to-end integration programme delivery',category:'delivery_execution',importance:'core',requirement:'Lead end-to-end integration programmes.',minimumYears:0,evidenceRule:'all_groups',evidenceGroups:[{label:'delivery',directEvidenceTerms:['end-to-end integration programmes'],transferableEvidenceTerms:['full lifecycle execution']}],directEvidenceTerms:['end-to-end integration programmes'],transferableEvidenceTerms:['full lifecycle execution'],jdEvidence:['Lead end-to-end integration programmes.']},
  {id:'transform',capability:'M&A integration or large-scale business transformation',category:'domain_functional_expertise',importance:'critical',requirement:'Proven experience delivering M&A integrations or large-scale business transformation programmes.',minimumYears:0,evidenceRule:'any_group',evidenceGroups:[{label:'M&A integration',directEvidenceTerms:['M&A integrations'],transferableEvidenceTerms:[]},{label:'business transformation',directEvidenceTerms:['large-scale business transformation'],transferableEvidenceTerms:['enterprise transformation']}],directEvidenceTerms:['M&A integrations','large-scale business transformation'],transferableEvidenceTerms:['enterprise transformation'],jdEvidence:['Proven experience delivering M&A integrations or large-scale business transformation programmes.']}
]}

test('uses AI for semantic evidence judgement but deterministic code for the final percentage',async()=>{
  const stages=[]
  const result=await analyzeExpertiseMatch({job,cvText,modelCall:async args=>{
    stages.push(args.stage)
    if(args.stage==='expertise_requirements') return structuredClone(requirements)
    if(args.stage==='expertise_evaluation') return {evaluations:[
      {id:'delivery',status:'MATCHED',cvEvidence:['Accountable for full lifecycle execution over 3.5 years.'],reason:'Equivalent delivery lifecycle evidence.'},
      {id:'transform',status:'MATCHED',cvEvidence:['large enterprise transformation programmes.'],reason:'The OR requirement is satisfied by the transformation branch.'}
    ]}
    throw new Error('unexpected stage')
  }})
  assert.deepEqual(stages,['expertise_requirements','expertise_evaluation'])
  assert.equal(result.expertiseMatch,100)
})
