import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {evaluateJobConditions} from './job-conditions.js'

test('missing visible vacancy facts normalize to N/A',()=>{
  const result=evaluateJobConditions({}, {})
  assert.equal(result.area.value,'N/A')
  assert.equal(result.employmentType.value,'N/A')
  assert.equal(result.workModel.value,'N/A')
})

test('main vacancy fact cards visually promote factual values and hide match scores',async()=>{
  const css=await readFile(new URL('../v15-polish.css',import.meta.url),'utf8')
  assert.match(css,/\.conditionCard\s*>\s*b\s*\{[^}]*display\s*:\s*none/s)
  assert.match(css,/\.conditionCard\s*>\s*span\s*\{[^}]*font-size\s*:\s*24px/s)
})
