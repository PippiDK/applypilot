import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile role editor preserves spaces while typing and normalizes only on blur',()=>{
  const component=fs.readFileSync(new URL('../components/search-profile-roles-step.js',import.meta.url),'utf8')

  assert.match(component,/useState/)
  assert.match(component,/setPrimaryText\(event\.target\.value\)/)
  assert.match(component,/setAdjacentText\(event\.target\.value\)/)
  assert.match(component,/onBlur=\{\(\)=>onPrimaryChange\(cleanLines\(primaryText\)\)\}/)
  assert.match(component,/onBlur=\{\(\)=>onAdjacentChange\(cleanLines\(adjacentText\)\)\}/)
})
