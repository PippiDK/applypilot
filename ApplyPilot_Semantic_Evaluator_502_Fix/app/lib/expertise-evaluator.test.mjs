import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateExpertiseSemantically} from './expertise-evaluator.js'

const requirements=[{
  id:'delivery',capability:'End-to-end programme delivery',category:'delivery_execution',importance:'core',
  requirement:'Lead end-to-end programme delivery.',minimumYears:0,evidenceRule:'all_groups',
  evidenceGroups:[{label:'delivery',directEvidenceTerms:['end-to-end programme delivery'],transferableEvidenceTerms:['full lifecycle execution']}],
  directEvidenceTerms:['end-to-end programme delivery'],transferableEvidenceTerms:['full lifecycle execution'],jdEvidence:['Lead end-to-end programme delivery.']
}]
const cv='Senior Project Manager. Accountable for full lifecycle execution over 3.5 years, from planning through go-live and operational handover.'

test('passes Source CV and structured requirements to a dedicated semantic evaluation stage',async()=>{
  let captured
  const result=await evaluateExpertiseSemantically(requirements,cv,async args=>{
    captured=args
    return {evaluations:[{id:'delivery',status:'MATCHED',cvEvidence:['Accountable for full lifecycle execution over 3.5 years, from planning through go-live and operational handover.'],reason:'Full lifecycle delivery is semantically equivalent to end-to-end programme delivery.'}]}
  })
  assert.equal(captured.stage,'expertise_evaluation')
  assert.equal(captured.input.sourceCv,cv)
  assert.equal(captured.input.requirements[0].id,'delivery')
  assert.equal(result.evaluations[0].status,'MATCHED')
})

test('rejects invented CV evidence instead of allowing the evaluator to hallucinate fit',async()=>{
  await assert.rejects(
    ()=>evaluateExpertiseSemantically(requirements,cv,async()=>({evaluations:[{id:'delivery',status:'MATCHED',cvEvidence:['Led multiple M&A integrations across Europe.'],reason:'Strong evidence.'}]})),
    /Semantic Expertise Match validation failed/i
  )
})

test('semantic schema requires exactly one evaluation per supplied requirement and constrains IDs',async()=>{
  const multi=[
    requirements[0],
    {id:'stakeholders',capability:'Executive stakeholder engagement',category:'leadership_stakeholder_scope',importance:'core',requirement:'Engage executive stakeholders.',minimumYears:0,evidenceRule:'all_groups',evidenceGroups:[{label:'stakeholders',directEvidenceTerms:['executive stakeholders'],transferableEvidenceTerms:['executive reporting']}],directEvidenceTerms:['executive stakeholders'],transferableEvidenceTerms:['executive reporting'],jdEvidence:['Engage executive stakeholders.']}
  ]
  const multiCv=`${cv} Owned executive-level reporting.`
  let captured
  await evaluateExpertiseSemantically(multi,multiCv,async args=>{
    captured=args
    return {evaluations:[
      {id:'delivery',status:'MATCHED',cvEvidence:['full lifecycle execution over 3.5 years'],reason:'Equivalent delivery scope.'},
      {id:'stakeholders',status:'MATCHED',cvEvidence:['executive-level reporting'],reason:'Executive stakeholder evidence.'}
    ]}
  })
  const evaluations=captured.schema.properties.evaluations
  assert.equal(evaluations.minItems,2)
  assert.equal(evaluations.maxItems,2)
  assert.deepEqual(evaluations.items.properties.id.enum,['delivery','stakeholders'])
})

test('truth guard accepts short verbatim words despite harmless punctuation differences',async()=>{
  const result=await evaluateExpertiseSemantically(requirements,cv,async()=>({evaluations:[
    {id:'delivery',status:'MATCHED',cvEvidence:['full lifecycle execution over 3.5 years from planning'],reason:'Equivalent delivery scope.'}
  ]}))
  assert.equal(result.evaluations[0].status,'MATCHED')
})

test('post-validation failures preserve a semantic validation error code for server diagnostics',async()=>{
  await assert.rejects(
    ()=>evaluateExpertiseSemantically(requirements,cv,async()=>({evaluations:[
      {id:'delivery',status:'MATCHED',cvEvidence:['invented M&A integration evidence'],reason:'Not grounded.'}
    ]})),
    error=>error?.code==='AI_SEMANTIC_VALIDATION'
  )
})
