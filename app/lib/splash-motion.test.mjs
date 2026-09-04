import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('Precision Launch uses a short scan then builds the mark',()=>{
  assert.equal(SPLASH_MOTION.scanDelayMs,120)
  assert.equal(SPLASH_MOTION.scanDurationMs,650)
  assert.equal(SPLASH_MOTION.markDelayMs,360)
  assert.equal(SPLASH_MOTION.markDurationMs,850)
})

test('navigation arc is short, delayed, and has no moving dots',()=>{
  assert.equal(SPLASH_MOTION.arcDelayMs,900)
  assert.equal(SPLASH_MOTION.arcDurationMs,1050)
  assert.equal(SPLASH_MOTION.showTraveller,false)
  assert.equal(SPLASH_MOTION.showStartPoint,false)
  assert.equal('motionPath' in SPLASH_MOTION,false)
})

test('wordmark arrives after the mark with restrained zoom',()=>{
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,1780)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,820)
  assert.equal(SPLASH_MOTION.wordmarkStartScale,0.72)
  assert.equal(SPLASH_MOTION.wordmarkEndScale,1)
  assert.ok(SPLASH_MOTION.wordmarkDelayMs>SPLASH_MOTION.arcDelayMs)
})

test('intro becomes stable before four seconds',()=>{
  assert.equal(SPLASH_MOTION.taglineDelayMs,2360)
  assert.equal(SPLASH_MOTION.entryDelayMs,2860)
  assert.equal(SPLASH_MOTION.introStableMs,3420)
  assert.ok(SPLASH_MOTION.introStableMs<4000)
})

test('entry keeps the approved gold START treatment',()=>{
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
