import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('flight path is one clean continuous climb-descent-climb route',()=>{
  assert.equal(SPLASH_MOTION.path,'M 92 242 C 130 200 160 145 205 108 C 232 125 252 175 224 236 C 266 218 308 174 350 126')
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
