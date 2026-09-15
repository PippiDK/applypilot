import test from 'node:test'
import assert from 'node:assert/strict'
import {distinctRecoveryError} from './night-flight-review-errors.js'

test('Morning Review renders an identical saved and recovery failure only once',()=>{
  assert.equal(
    distinctRecoveryError('AI_PROVIDER_HTTP_429 · Match failed.','AI_PROVIDER_HTTP_429 · Match failed.'),
    '',
  )
})

test('Morning Review keeps a distinct manual recovery failure visible',()=>{
  assert.equal(
    distinctRecoveryError('AI_PROVIDER_HTTP_429 · Match failed.','Recovery request could not be completed.'),
    'Recovery request could not be completed.',
  )
})
