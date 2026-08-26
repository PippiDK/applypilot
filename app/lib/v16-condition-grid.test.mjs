import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css=fs.readFileSync(new URL('../v15-polish.css',import.meta.url),'utf8')

test('main condition grid hides Salary and uses three columns',()=>{
  assert.match(css,/\.conditionGrid\s*>\s*\.conditionCard:nth-child\(2\)\s*\{[\s\S]*display\s*:\s*none/)
  assert.match(css,/\.conditionGrid\s*\{[\s\S]*grid-template-columns\s*:\s*repeat\(3\s*,\s*1fr\)/)
})
