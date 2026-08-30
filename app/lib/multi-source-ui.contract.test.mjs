import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('main screen exposes equal LinkedIn and Jobindex source controls',()=>{
  assert.match(page,/SEARCH SOURCES/)
  assert.match(page,/>LinkedIn</)
  assert.match(page,/>Jobindex</)
  assert.doesNotMatch(page,/LINKEDIN · PUBLIC/)
  assert.doesNotMatch(page,/ONE SOURCE · END-TO-END/)
})

test('main search uses persisted source selection and multi-source API',()=>{
  assert.match(page,/readSearchSources\(localStorage\)/)
  assert.match(page,/writeSearchSources\(localStorage/)
  assert.match(page,/\/api\/multi-source-search/)
  assert.match(page,/enabledSources:selectedSources/)
})

test('result source labels come from normalized provenance',()=>{
  assert.match(page,/sourceLabel\(job\)/)
  assert.doesNotMatch(page,/Source: LinkedIn ·/)
})

test('search button copy is source-neutral',()=>{
  assert.doesNotMatch(page,/Search LinkedIn/)
  assert.doesNotMatch(page,/Reading LinkedIn JDs/)
})
