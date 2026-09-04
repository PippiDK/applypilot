import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {SPLASH_MOTION} from './splash-motion.js'

const splashSource=readFileSync(new URL('../components/splash-gate.js',import.meta.url),'utf8')

test('uses the approved Flight Path A asset as a visible HTML image layer',()=>{
  assert.equal(SPLASH_MOTION.logoAsset,'/flight-path-a-visible-v2.webp')
  assert.equal(SPLASH_MOTION.logoRender,'html-img')
})

test('matches the logo-to-wordmark pause to the tagline-to-START pause without changing animation speeds',()=>{
  const logoEnd=SPLASH_MOTION.logoZoomDelayMs+SPLASH_MOTION.logoZoomDurationMs
  assert.equal(logoEnd,4200)
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,4800)
  assert.equal(SPLASH_MOTION.wordmarkDelayMs-logoEnd,600)
  assert.equal(SPLASH_MOTION.entryDelayMs-SPLASH_MOTION.taglineDelayMs,600)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,1800)
  assert.equal(SPLASH_MOTION.taglineDelayMs,5900)
  assert.equal(SPLASH_MOTION.entryDelayMs,6500)
  assert.equal(SPLASH_MOTION.introStableMs,8800)
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
