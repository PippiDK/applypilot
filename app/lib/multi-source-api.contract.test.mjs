import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const route=fs.readFileSync(new URL('../api/multi-source-search/route.js',import.meta.url),'utf8')

test('multi-source route requires auth and validates source selection',()=>{
  assert.match(route,/requireUser/)
  assert.match(route,/Select at least one search source\./)
})

test('multi-source route uses orchestrator and both source adapters',()=>{
  assert.match(route,/runMultiSourceSearch/)
  assert.match(route,/searchLinkedInSource/)
  assert.match(route,/searchJobindexSource/)
})

test('route preserves shared Search Profile input instead of creating source-specific profile',()=>{
  assert.match(route,/unionSearchPlan/)
  assert.doesNotMatch(route,/jobindexProfile|linkedinProfile/)
})
