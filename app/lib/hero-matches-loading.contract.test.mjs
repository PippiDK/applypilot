import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('hero matches uses animated loading dots only while search is running',()=>{
  assert.match(page,/state\.loading\?<span className="matchesLoadingDots"/)
  assert.match(page,/aria-label="Searching"/)
  assert.match(page,/:jobs\.length/)
  assert.match(css,/\.matchesLoadingDots i/)
  assert.match(css,/@keyframes matchesDotPulse/)
  assert.match(css,/prefers-reduced-motion/)
})
