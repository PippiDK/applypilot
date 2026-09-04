import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {SPLASH_MOTION} from './splash-motion.js'

const splashSource=readFileSync(new URL('../components/splash-gate.js',import.meta.url),'utf8')

test('uses the approved Flight Path A asset as a visible HTML image layer',()=>{
  assert.equal(SPLASH_MOTION.logoAsset,'/flight-path-a-visible-v2.webp')
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

test('removes the airplane overlay while preserving logo and copy',()=>{
  assert.equal(splashSource.includes('function PaperPlane'),false)
  assert.equal(splashSource.includes('<PaperPlane/>'),false)
  assert.equal(splashSource.includes('orbitTrail'),false)
  assert.equal(splashSource.includes('<svg className={styles.logo}'),false)
  assert.equal(splashSource.includes('SPLASH_MOTION.logoAsset'),true)
  assert.equal(splashSource.includes('Apply'),true)
  assert.equal(splashSource.includes('START'),false)
  assert.equal(SPLASH_MOTION.entryLabel,'START')
  assert.equal(SPLASH_MOTION.entryColor,'#f4c542')
  assert.equal(SPLASH_MOTION.entryShine,true)
})
