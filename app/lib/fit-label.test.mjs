import test from 'node:test'
import assert from 'node:assert/strict'
import { fitLabel } from './fit-label.js'

test('maps displayed fit score to High Medium Low thresholds',()=>{
  assert.equal(fitLabel(100),'High')
  assert.equal(fitLabel(90),'High')
  assert.equal(fitLabel(89),'Medium')
  assert.equal(fitLabel(80),'Medium')
  assert.equal(fitLabel(79),'Low')
  assert.equal(fitLabel(50),'Low')
})
