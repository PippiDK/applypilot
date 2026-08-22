import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateExpertise,matchRequirementEvidence} from './expertise-match.js'

const req=(overrides={})=>({
  id:'r1',
  capability:'End-to-end delivery',
  category:'delivery_execution',
  importance:'core',
  requirement:'Lead end-to-end delivery.',
  minimumYears:0,
  directEvidenceTerms:['end-to-end delivery'],
  transferableEvidenceTerms:['project delivery'],
  jdEvidence:['Lead end-to-end delivery.'],
  ...overrides
})

test('classifies direct CV evidence as MATCHED and transferable evidence only as PARTIAL',()=>{
  assert.equal(matchRequirementEvidence(req(), 'Senior manager with end-to-end delivery ownership.').status,'MATCHED')
  assert.equal(matchRequirementEvidence(req(), 'Senior manager with complex project delivery ownership.').status,'PARTIAL')
  assert.equal(matchRequirementEvidence(req(), 'Senior museum curator and exhibition planner.').status,'NOT_EVIDENCED')
})

test('a minimum-years requirement is not fully matched unless duration is evidenced for the same capability',()=>{
  const requirement=req({
    capability:'5+ years Data & AI initiative leadership',
    category:'required_experience_qualifications',
    importance:'critical',
    minimumYears:5,
    directEvidenceTerms:['Data & AI initiatives','AI initiatives'],
    transferableEvidenceTerms:['data initiatives']
  })
  assert.equal(matchRequirementEvidence(requirement,'Led AI initiatives across the enterprise.').status,'PARTIAL')
  assert.equal(matchRequirementEvidence(requirement,'More than 6 years leading AI initiatives across the enterprise.').status,'MATCHED')
  assert.equal(matchRequirementEvidence(requirement,'18+ years in IT. Led AI initiatives last year.').status,'PARTIAL')
})

test('calculates Expertise Match only from professional requirements and returns the five approved breakdown dimensions',()=>{
  const requirements=[
    req({id:'delivery',importance:'core'}),
    req({id:'domain',capability:'Financial IT',category:'domain_functional_expertise',importance:'core',directEvidenceTerms:['financial IT'],transferableEvidenceTerms:['regulated enterprise']}),
    req({id:'technical',capability:'Generative AI',category:'technical_platform_capabilities',importance:'critical',directEvidenceTerms:['Generative AI'],transferableEvidenceTerms:['data platform']}),
    req({id:'leadership',capability:'Senior stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',directEvidenceTerms:['senior stakeholders'],transferableEvidenceTerms:['stakeholder management']}),
    req({id:'qualification',capability:'PMP certification',category:'required_experience_qualifications',importance:'supporting',directEvidenceTerms:['PMP'],transferableEvidenceTerms:[]})
  ]
  const result=evaluateExpertise(requirements,'Senior IT leader with end-to-end delivery, financial IT, senior stakeholders and data platform experience.')
  assert.ok(result.expertiseMatch>0&&result.expertiseMatch<100)
  assert.deepEqual(Object.keys(result.breakdown),[
    'delivery_execution','domain_functional_expertise','technical_platform_capabilities','leadership_stakeholder_scope','required_experience_qualifications'
  ])
  assert.equal(result.requirements.find(x=>x.id==='technical').status,'PARTIAL')
  assert.equal(result.requirements.find(x=>x.id==='qualification').status,'NOT_EVIDENCED')
})

test('critical missing expertise has more scoring impact than an otherwise identical supporting gap',()=>{
  const matched=req({id:'matched',importance:'core'})
  const criticalMissing=req({id:'gap',capability:'Specialist AI',importance:'critical',directEvidenceTerms:['specialist AI'],transferableEvidenceTerms:[]})
  const supportingMissing={...criticalMissing,importance:'supporting'}
  const cv='Strong end-to-end delivery experience across complex enterprise technology programmes and cross-functional teams.'
  const withCritical=evaluateExpertise([matched,criticalMissing],cv)
  const withSupporting=evaluateExpertise([matched,supportingMissing],cv)
  assert.ok(withCritical.expertiseMatch<withSupporting.expertiseMatch)
})

test('Why you fit contains strongest evidenced capabilities and Expertise gaps prioritise critical missing evidence',()=>{
  const requirements=[
    req({id:'delivery',capability:'End-to-end complex delivery',importance:'core'}),
    req({id:'stake',capability:'Senior stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',directEvidenceTerms:['executive reporting'],transferableEvidenceTerms:['stakeholder management']}),
    req({id:'ai',capability:'ML / Generative AI delivery',category:'technical_platform_capabilities',importance:'critical',directEvidenceTerms:['Generative AI','Machine Learning'],transferableEvidenceTerms:['data platform']}),
    req({id:'rai',capability:'Responsible AI',category:'domain_functional_expertise',importance:'core',directEvidenceTerms:['Responsible AI'],transferableEvidenceTerms:[]})
  ]
  const result=evaluateExpertise(requirements,'Led end-to-end delivery with executive reporting and enterprise data platforms.')
  assert.ok(result.whyYouFit.some(x=>/End-to-end complex delivery/i.test(x)))
  assert.match(result.expertiseGaps[0],/ML \/ Generative AI delivery/i)
  assert.ok(result.expertiseGaps.every(x=>/Source CV/i.test(x)))
})
