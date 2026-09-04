import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('Approach Fly-by brings the logo from far away',()=>{
  assert.equal(SPLASH_MOTION.concept,'approach-flyby')
  assert.equal(SPLASH_MOTION.logoZoomDelayMs,200)
  assert.equal(SPLASH_MOTION.logoZoomDurationMs,1900)
  assert.equal(SPLASH_MOTION.logoStartScale,0.12)
  assert.equal(SPLASH_MOTION.logoEndScale,1)
})

test('paper plane makes one wide orbit with back and front depth phases',()=>{
  assert.equal(SPLASH_MOTION.planeBackPath,'M 424 92 C 330 20 140 18 70 126 C 8 222 68 340 184 360')
  assert.equal(SPLASH_MOTION.planeFrontPath,'M 184 360 C 302 366 410 292 442 186 C 459 129 468 75 454 34')
  assert.equal(SPLASH_MOTION.planeDelayMs,420)
  assert.equal(SPLASH_MOTION.planeBackDurationMs,1450)
  assert.equal(SPLASH_MOTION.planeFrontDelayMs,1710)
  assert.equal(SPLASH_MOTION.planeFrontDurationMs,1250)
  assert.equal(SPLASH_MOTION.planeStyle,'origami-outline')
})

test('old scan and navigation arc choreography is removed',()=>{
  assert.equal('scanDelayMs' in SPLASH_MOTION,false)
  assert.equal('arcDelayMs' in SPLASH_MOTION,false)
})

test('brand copy waits until the logo is close and settled',()=>{
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,2550)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,900)
  assert.equal(SPLASH_MOTION.wordmarkStartScale,0.76)
  assert.equal(SPLASH_MOTION.taglineDelayMs,3250)
  assert.equal(SPLASH_MOTION.entryDelayMs,3550)
  assert.equal(SPLASH_MOTION.introStableMs,4200)
})

test('entry keeps the approved gold START treatment',()=>{
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
