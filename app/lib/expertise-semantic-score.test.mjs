import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateExpertiseFromJudgements} from './expertise-semantic-score.js'

const req=(overrides={})=>({
  id:'r1',capability:'End-to-end programme delivery',category:'delivery_execution',importance:'core',
  requirement:'Lead end-to-end programme delivery.',minimumYears:0,evidenceRule:'all_groups',evidenceGroups:[],
  directEvidenceTerms:[],transferableEvidenceTerms:[],jdEvidence:['Lead end-to-end programme delivery.'],...overrides
})

const judgement=(overrides={})=>({id:'r1',status:'MATCHED',cvEvidence:['Accountable for full lifecycle execution over 3.5 years.'],reason:'Semantically equivalent end-to-end delivery evidence.',...overrides})

test('semantic MATCHED, TRANSFERABLE, PARTIAL and NOT_EVIDENCED receive conservative deterministic credits',()=>{
  const requirements=[
    req({id:'m',importance:'core'}),
    req({id:'t',capability:'M&A integration delivery',importance:'core'}),
    req({id:'p',capability:'AI initiative leadership',importance:'core'}),
    req({id:'n',capability:'Responsible AI',importance:'core'})
  ]
  const evaluations=[
    judgement({id:'m',status:'MATCHED'}),
    judgement({id:'t',status:'TRANSFERABLE'}),
    judgement({id:'p',status:'PARTIAL'}),
    judgement({id:'n',status:'NOT_EVIDENCED',cvEvidence:[]})
  ]
  const result=evaluateExpertiseFromJudgements(requirements,evaluations)
  assert.equal(result.expertiseMatch,41) // (1 + .25 + .4 + 0) / 4
})

test('TRANSFERABLE is a conservative expertise gap and never a visible strength',()=>{
  const requirements=[
    req({id:'m',capability:'End-to-end programme delivery'}),
    req({id:'t',capability:'Creative production context'}),
    req({id:'p',capability:'External shoot production management'}),
    req({id:'n',capability:'Brand process expertise'})
  ]
  const evaluations=[
    judgement({id:'m',status:'MATCHED'}),
    judgement({id:'t',status:'TRANSFERABLE'}),
    judgement({id:'p',status:'PARTIAL'}),
    judgement({id:'n',status:'NOT_EVIDENCED',cvEvidence:[]})
  ]
  const result=evaluateExpertiseFromJudgements(requirements,evaluations)
  assert.deepEqual(result.whyYouFit,['End-to-end programme delivery'])
  assert.deepEqual(result.transferableStrengths,[])
  assert.ok(result.expertiseGaps.some(x=>/Creative production context.*specialist context not evidenced/.test(x)))
  assert.ok(result.expertiseGaps.some(x=>/External shoot production management/.test(x)))
  assert.ok(result.expertiseGaps.some(x=>/Brand process expertise/.test(x)))
})

test('Annapurna-style evidence stays high while specialist M&A context remains explicit as a gap',()=>{
  const requirements=[
    req({id:'delivery',capability:'End-to-end integration programme delivery',category:'delivery_execution',importance:'core'}),
    req({id:'cross',capability:'Cross-functional workstream leadership',category:'leadership_stakeholder_scope',importance:'core'}),
    req({id:'exec',capability:'Executive stakeholder alignment and engagement',category:'leadership_stakeholder_scope',importance:'core'}),
    req({id:'transform',capability:'M&A integration OR large-scale business transformation',category:'domain_functional_expertise',importance:'critical',evidenceRule:'any_group'}),
    req({id:'hands',capability:'Hands-on M&A integration planning and execution',category:'domain_functional_expertise',importance:'core'})
  ]
  const evaluations=[
    judgement({id:'delivery',status:'MATCHED'}),
    judgement({id:'cross',status:'MATCHED'}),
    judgement({id:'exec',status:'MATCHED'}),
    judgement({id:'transform',status:'MATCHED'}),
    judgement({id:'hands',status:'TRANSFERABLE'})
  ]
  const result=evaluateExpertiseFromJudgements(requirements,evaluations)
  assert.ok(result.expertiseMatch>=85,`unexpected ${result.expertiseMatch}%`)
  assert.equal(result.breakdown.delivery_execution.score,100)
  assert.equal(result.breakdown.leadership_stakeholder_scope.score,100)
  assert.deepEqual(result.transferableStrengths,[])
  assert.ok(result.expertiseGaps.some(x=>/Hands-on M&A integration planning and execution.*specialist context not evidenced/i.test(x)))
})
