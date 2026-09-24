import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {safeValidationDiagnosticCode} from './night-flight-validation-diagnostics.js'
import {evaluateExpertiseOnePass} from './expertise-one-pass.js'

test('validation diagnosis classifies exact JD and CV quote failures without exposing evidence',()=>{
  assert.equal(safeValidationDiagnosticCode(new Error('Source CV evidence for SECRET-ID was not found in Source CV.')),'CV_EVIDENCE_NOT_IN_SOURCE')
  assert.equal(safeValidationDiagnosticCode(new Error('JD evidence for SECRET-ID was not found in the job description.')),'JD_EVIDENCE_NOT_IN_DESCRIPTION')
  assert.equal(safeValidationDiagnosticCode(new Error('Unsafe prompt-like JD evidence in SECRET-ID.')),'UNSAFE_JD_EVIDENCE')
  assert.equal(safeValidationDiagnosticCode(new Error('Source CV evidence is required for SECRET-ID.')),'CV_EVIDENCE_MISSING')
  assert.equal(safeValidationDiagnosticCode(new Error('Expertise Match requirement IDs must be unique.')),'DUPLICATE_REQUIREMENT_ID')
  assert.equal(safeValidationDiagnosticCode(new Error('Unrecognized private error: MY-CV-SECRET')),'OTHER_VALIDATION')
})

test('one-pass validator retains the original non-retryable AI code with a safe diagnostic label',async()=>{
  const job={title:'Programme Manager',company:'Example',description:'Lead programme implementation and deliver technology transformation projects with stakeholder management, planning and governance.'}
  const cv='Senior Project Manager with technology transformation experience and cross-functional delivery, stakeholder management and governance.'
  const items=[{id:'one',capability:'Programme delivery',category:'delivery_execution',importance:'core',requirement:'Lead programme implementation',minimumYears:0,jdEvidence:['Lead programme implementation'],status:'MATCHED',cvEvidence:['PRIVATE-NOT-IN-CV'],reason:'Experience aligns.'}]
  await assert.rejects(evaluateExpertiseOnePass(job,cv,async()=>({items})),error=>{
    assert.equal(error.code,'AI_EXPERTISE_VALIDATION')
    assert.equal(error.diagnosticCode,'CV_EVIDENCE_NOT_IN_SOURCE')
    return true
  })
})

test('only safe validation categories are persisted; raw CV and raw JD details stay private',()=>{
  const queue=readFileSync(new URL('./night-flight-match-queue.js',import.meta.url),'utf8')
  assert.match(queue,/error\?\.diagnosticCode/)
  assert.match(queue,/VALIDATION_DIAGNOSTIC_CODES/)
  assert.match(queue,/safeCode\s*&&\s*code==='AI_EXPERTISE_VALIDATION'/)
  assert.doesNotMatch(queue,/console\.error\([^\n]*(sourceCv|jobDescription|fullJd)/)
})
