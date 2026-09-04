import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('logo keeps the far-away approach and adds the approved glow treatment',()=>{
  assert.equal(SPLASH_MOTION.concept,'glowing-flightpath-flyby')
  assert.equal(SPLASH_MOTION.logoZoomDelayMs,200)
  assert.equal(SPLASH_MOTION.logoZoomDurationMs,1900)
  assert.equal(SPLASH_MOTION.logoStartScale,0.12)
  assert.equal(SPLASH_MOTION.logoGlow,true)
})

test('paper plane launches from the final arrow tip and makes one orbit',()=>{
  assert.equal(SPLASH_MOTION.planeLaunchPoint,'447 207')
  assert.ok(SPLASH_MOTION.planeOrbitPath.startsWith('M 447 207'))
  assert.match(SPLASH_MOTION.planeOrbitPath,/C/)
  assert.equal(SPLASH_MOTION.planeDelayMs,2050)
  assert.equal(SPLASH_MOTION.planeDurationMs,2350)
  assert.equal(SPLASH_MOTION.planeStyle,'origami-mint')
  assert.equal(SPLASH_MOTION.orbitTrail,true)
})

test('text and gold START treatment remain unchanged',()=>{
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,2550)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,900)
  assert.equal(SPLASH_MOTION.wordmarkStartScale,0.76)
  assert.equal(SPLASH_MOTION.wordmarkApplyWeight,500)
  assert.equal(SPLASH_MOTION.wordmarkPilotWeight,780)
  assert.equal(SPLASH_MOTION.wordmarkLetterSpacingEm,-0.04)
  assert.equal(SPLASH_MOTION.taglineDelayMs,3250)
  assert.equal(SPLASH_MOTION.entryDelayMs,3550)
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
