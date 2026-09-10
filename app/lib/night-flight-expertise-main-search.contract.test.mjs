import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const mainSearch=fs.readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('Main Search resolves the selected Night Flight cached analysis from the existing Night Flight index',()=>{
  assert.match(page,/resolveNightFlightExpertise/)
  assert.match(page,/activeNightFlightJob/)
})

test('Main Search replaces the visible expertiseHero with the cached Night Flight analysis instead of offering a new AI run',()=>{
  assert.match(page,/nightFlightExpertiseHero/)
  assert.match(page,/expertiseHero/)
  assert.match(page,/cachedNightFlightAnalysis/)
})

test('selected Main Search vacancy strips React child-key prefixes before the Night Flight lookup',()=>{
  assert.match(page,/function visibleElementKey\(value\)/)
  assert.match(page,/lastIndexOf\('\$'\)/)
  assert.match(page,/slice\(marker\+1\)/)
  assert.doesNotMatch(page,/replace\(\/\^\\\.\\\$\//)
})
