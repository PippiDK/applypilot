import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateExpertiseFromJudgements} from './expertise-semantic-score.js'
import {EXPERTISE_ONE_PASS_INSTRUCTIONS} from './expertise-one-pass.js'
import {expertiseMatchCacheKey} from './expertise-match-cache.js'

const req=(id,capability,category='delivery_execution',importance='core')=>({
  id,capability,category,importance,requirement:capability,minimumYears:0,
  evidenceRule:'all_groups',evidenceGroups:[],directEvidenceTerms:[],transferableEvidenceTerms:[],jdEvidence:[capability]
})
const ev=(id,status)=>({id,status,cvEvidence:status==='NOT_EVIDENCED'?[]:['verified Source CV evidence'],reason:'Regression fixture.'})

test('Bug 6 JOE: specialist transferable context is a gap, never a strength',()=>{
  const result=evaluateExpertiseFromJudgements([
    req('delivery','End-to-end project delivery'),
    req('creative','Creative production context','domain_functional_expertise'),
    req('shoot','External shoot production management','domain_functional_expertise')
  ],[
    ev('delivery','MATCHED'),
    ev('creative','TRANSFERABLE'),
    ev('shoot','NOT_EVIDENCED')
  ])

  assert.deepEqual(result.whyYouFit,['End-to-end project delivery'])
  assert.deepEqual(result.transferableStrengths,[])
  assert.ok(result.expertiseGaps.some(item=>/Creative production context.*specialist context not evidenced/i.test(item)))
})

test('Bug 6 ABB: payroll-domain transferability cannot become payroll expertise',()=>{
  const result=evaluateExpertiseFromJudgements([
    req('transform','Enterprise transformation delivery'),
    req('cross','Cross-functional leadership','leadership_stakeholder_scope'),
    req('payroll','Payroll / employee lifecycle domain experience','domain_functional_expertise')
  ],[
    ev('transform','MATCHED'),
    ev('cross','MATCHED'),
    ev('payroll','TRANSFERABLE')
  ])

  assert.ok(result.whyYouFit.includes('Enterprise transformation delivery'))
  assert.ok(result.whyYouFit.includes('Cross-functional leadership'))
  assert.ok(!result.transferableStrengths.includes('Payroll / employee lifecycle domain experience'))
  assert.ok(result.expertiseGaps.some(item=>/Payroll \/ employee lifecycle domain experience.*specialist context not evidenced/i.test(item)))
})

test('Bug 6: TRANSFERABLE is limited scoring signal at 25 percent credit',()=>{
  const result=evaluateExpertiseFromJudgements([req('transfer','Specialist context')],[ev('transfer','TRANSFERABLE')])
  assert.equal(result.expertiseMatch,25)
})

test('Bug 6: supporting-only breakdown category is N/A rather than 100 percent',()=>{
  const result=evaluateExpertiseFromJudgements([
    req('delivery','Project delivery','delivery_execution','core'),
    req('tool','Generic tool familiarity','technical_platform_capabilities','supporting')
  ],[
    ev('delivery','MATCHED'),
    ev('tool','MATCHED')
  ])

  assert.equal(result.breakdown.delivery_execution.score,100)
  assert.equal(result.breakdown.technical_platform_capabilities.score,null)
})

test('Bug 6: evaluator prompt protects category boundaries and generic-vs-specialist splitting',()=>{
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/payroll/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/technical_platform_capabilities[^\n]*(?:tools|systems|platforms)/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/required_experience_qualifications[^\n]*(?:years|degree|certification|language|eligibility)/i)
  assert.match(EXPERTISE_ONE_PASS_INSTRUCTIONS,/generic transformation delivery/i)
})

test('Bug 6: Expertise Match uses fresh v3 cache namespace',()=>{
  assert.match(expertiseMatchCacheKey('4407027317','cv-v1'),/^applypilot-expertise-match:v3:/)
})
