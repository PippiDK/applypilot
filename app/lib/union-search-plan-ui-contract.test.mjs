import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const componentUrl=new URL('../components/search-plan-preview.js',import.meta.url)

test('confirm Search plan details is collapsed by default and retains counts, tiers and provenance',async()=>{
  const source=await readFile(componentUrl,'utf8')
  assert.match(source,/<details className="truth searchPlanPreview">/)
  assert.doesNotMatch(source,/<details[^>]*\sopen(?:=|\s|>)/)
  assert.match(source,/Search plan details/)
  assert.match(source,/plan\?\.directions/)
  assert.match(source,/directions\.length/)
  assert.match(source,/primaryCount/)
  assert.match(source,/adjacentCount/)
  assert.match(source,/PRIMARY/)
  assert.match(source,/ADJACENT/)
  assert.match(source,/MANUAL/)
  assert.match(source,/cvSlots/)
})
