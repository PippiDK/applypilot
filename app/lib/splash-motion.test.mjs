import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('flight path matches the approved Flight Path A rising route',()=>{
  assert.equal(SPLASH_MOTION.path,'M 96 244 C 158 204 222 161 290 132 C 314 122 334 113 352 108')
})

test('splash motion is slightly slower and text still zooms in',()=>{
  assert.equal(SPLASH_MOTION.pathDurationMs,2050)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,1000)
  assert.ok(SPLASH_MOTION.wordmarkDelayMs>SPLASH_MOTION.pathDelayMs)
  assert.ok(SPLASH_MOTION.wordmarkStartScale<0.5)
  assert.equal(SPLASH_MOTION.wordmarkEndScale,1)
})

test('wordmark is stronger and slightly wider',()=>{
  assert.equal(SPLASH_MOTION.wordmarkApplyWeight,430)
  assert.equal(SPLASH_MOTION.wordmarkPilotWeight,780)
  assert.equal(SPLASH_MOTION.wordmarkLetterSpacingEm,-0.035)
})

test('entry label is the approved yellow START label',()=>{
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
})
