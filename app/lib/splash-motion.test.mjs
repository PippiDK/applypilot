import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('uses the approved logo asset rather than reconstructing the mark',()=>{
  assert.equal(SPLASH_MOTION.concept,'approved-logo-orbit')
  assert.equal(SPLASH_MOTION.logoAsset,'/flight-path-a-approved.webp')
  assert.equal(SPLASH_MOTION.logoGlow,true)
  assert.equal(SPLASH_MOTION.logoRender,'html-img')
})

test('paper plane launches from the approved arrow tip and makes one orbit',()=>{
  assert.equal(SPLASH_MOTION.planeLaunch,'arrow-tip')
  assert.ok(SPLASH_MOTION.planeOrbitPath.startsWith('M 517 249'))
  assert.equal(SPLASH_MOTION.planeDelayMs,2050)
  assert.equal(SPLASH_MOTION.planeDurationMs,2550)
})

test('brand copy and START treatment stay unchanged',()=>{
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,2550)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,900)
  assert.equal(SPLASH_MOTION.wordmarkApplyWeight,500)
  assert.equal(SPLASH_MOTION.wordmarkPilotWeight,780)
  assert.equal(SPLASH_MOTION.taglineDelayMs,3250)
  assert.equal(SPLASH_MOTION.entryDelayMs,3550)
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
