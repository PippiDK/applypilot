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
    /not found in Source CV/i
  )
})
