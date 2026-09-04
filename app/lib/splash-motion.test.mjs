import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('motion follows right-top to A apex to lower-left to final arc',()=>{
  assert.equal(SPLASH_MOTION.motionPath,'M 454 146 L 278 90 L 124 386 C 205 329 299 258 446 208')
  assert.equal(SPLASH_MOTION.motionTip,'M 431 190 L 466 203 L 440 228 Z')
})

test('motion layer is separate from the final logo and has no animated dots',()=>{
  assert.equal(SPLASH_MOTION.finalLogoRevealMs,2570)
  assert.equal(SPLASH_MOTION.motionFadeMs,520)
  assert.equal(SPLASH_MOTION.showTraveller,false)
  assert.equal(SPLASH_MOTION.showStartPoint,false)
})

test('wordmark waits for final-logo reveal and zooms in slowly',()=>{
  assert.equal(SPLASH_MOTION.pathDurationMs,2400)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,1050)
  assert.ok(SPLASH_MOTION.wordmarkDelayMs>SPLASH_MOTION.finalLogoRevealMs)
  assert.ok(SPLASH_MOTION.wordmarkStartScale<0.5)
  assert.equal(SPLASH_MOTION.wordmarkEndScale,1)
})

test('wordmark remains stronger and wider',()=>{
  assert.equal(SPLASH_MOTION.wordmarkApplyWeight,430)
  assert.equal(SPLASH_MOTION.wordmarkPilotWeight,780)
  assert.equal(SPLASH_MOTION.wordmarkLetterSpacingEm,-0.035)
})

test('entry remains the approved yellow START label',()=>{
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
})
