import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'

const here=dirname(fileURLToPath(import.meta.url))
const appDir=resolve(here,'..')
const layout=readFileSync(resolve(appDir,'layout.js'),'utf8')
const cssPath=resolve(appDir,'expertise-loader.css')

test('Root layout loads isolated Expertise Match loader animation styles',()=>{
  assert.match(layout,/import ['"]\.\/expertise-loader\.css['"]/)
  assert.equal(existsSync(cssPath),true)
})

test('Expertise loader animates three dots only while analysis is loading',()=>{
  const css=readFileSync(cssPath,'utf8')
  assert.match(css,/\.expertiseHero:has\(\.expertiseLoading\) \.expertiseScore/)
  assert.match(css,/radial-gradient/g)
  assert.match(css,/@keyframes expertiseDotsWave/)
  assert.match(css,/background-position/)
})
