import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const componentUrl=new URL('../components/search-plan-preview.js',import.meta.url)

test('confirm preview exposes plan counts, directions, tiers and provenance labels',async()=>{
  const source=await readFile(componentUrl,'utf8')
  assert.match(source,/SEARCH PLAN PREVIEW/)
  assert.match(source,/plan\?\.directions/)
  assert.match(source,/PRIMARY/)
  assert.match(source,/ADJACENT/)
  assert.match(source,/MANUAL/)
  assert.match(source,/cvSlots/)
})
