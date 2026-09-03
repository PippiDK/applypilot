import test from 'node:test'
import assert from 'node:assert/strict'
import {SPLASH_MOTION} from './splash-motion.js'

test('flight path is one continuous climb-descent-climb route',()=>{
  assert.equal(SPLASH_MOTION.path,'M 88 238 C 128 170 176 92 226 78 C 278 62 318 118 292 164 C 268 206 240 226 224 246 C 258 220 302 182 352 126')
})

test('splash text zooms in after the route begins',()=>{
  assert.ok(SPLASH_MOTION.wordmarkDelayMs>SPLASH_MOTION.pathDelayMs)
  assert.ok(SPLASH_MOTION.wordmarkStartScale<0.5)
  assert.equal(SPLASH_MOTION.wordmarkEndScale,1)
})

test('entry label is the approved yellow Russian label',()=>{
  assert.equal(SPLASH_MOTION.entryLabel,'Вход')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
})
