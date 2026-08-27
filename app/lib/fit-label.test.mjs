import test from 'node:test'
import assert from 'node:assert/strict'
import { fitLabel } from './fit-label.js'

test('maps displayed Search relevance to High Medium Low presentation bands',()=>{
  assert.equal(fitLabel(100),'High')
  assert.equal(fitLabel(90),'High')
  assert.equal(fitLabel(89),'Medium')
  assert.equal(fitLabel(80),'Medium')
  assert.equal(fitLabel(79),'Low')
  assert.equal(fitLabel(76),'Low')
})
