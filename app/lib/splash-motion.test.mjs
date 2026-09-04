import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('uses the approved Flight Path A asset as a visible HTML image layer',()=>{
  assert.equal(SPLASH_MOTION.logoAsset,'/flight-path-a-approved.webp')
  assert.equal(SPLASH_MOTION.logoRender,'html-img')
})

test('entire intro choreography is slowed exactly 2x',()=>{
  assert.equal(SPLASH_MOTION.logoZoomDelayMs,400)
  assert.equal(SPLASH_MOTION.logoZoomDurationMs,3800)
  assert.equal(SPLASH_MOTION.planeDelayMs,4100)
  assert.equal(SPLASH_MOTION.planeDurationMs,5100)
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,5100)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,1800)
  assert.equal(SPLASH_MOTION.taglineDelayMs,6500)
  assert.equal(SPLASH_MOTION.entryDelayMs,7100)
  assert.equal(SPLASH_MOTION.introStableMs,9400)
})

test('keeps plane orbit and START treatment unchanged',()=>{
  assert.equal(SPLASH_MOTION.planeLaunch,'arrow-tip')
  assert.ok(SPLASH_MOTION.planeOrbitPath.startsWith('M 517 249'))
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
