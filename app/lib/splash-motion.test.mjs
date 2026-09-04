import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {SPLASH_MOTION} from './splash-motion.js'

const splashSource=readFileSync(new URL('../components/splash-gate.js',import.meta.url),'utf8')

test('uses the approved Flight Path A asset as a visible HTML image layer',()=>{
  assert.equal(SPLASH_MOTION.logoAsset,'/flight-path-a-visible-v2.webp')
  assert.equal(SPLASH_MOTION.logoRender,'html-img')
})

test('starts text choreography one third into the logo motion and preserves text cadence',()=>{
  const oneThirdIntoLogo=Math.round(SPLASH_MOTION.logoZoomDelayMs+SPLASH_MOTION.logoZoomDurationMs/3)
  assert.equal(oneThirdIntoLogo,1667)
  assert.equal(SPLASH_MOTION.wordmarkDelayMs,oneThirdIntoLogo)
  assert.equal(SPLASH_MOTION.wordmarkDurationMs,1800)
  assert.equal(SPLASH_MOTION.taglineDelayMs-SPLASH_MOTION.wordmarkDelayMs,1100)
  assert.equal(SPLASH_MOTION.entryDelayMs-SPLASH_MOTION.taglineDelayMs,600)
  assert.equal(SPLASH_MOTION.taglineDelayMs,2767)
  assert.equal(SPLASH_MOTION.entryDelayMs,3367)
  assert.equal(SPLASH_MOTION.introStableMs,5667)
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
