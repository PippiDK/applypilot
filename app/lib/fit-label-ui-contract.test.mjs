import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('vacancy list renders fit labels instead of percentages',()=>{
  assert.match(page,/fitLabel\(score\)/)
  assert.doesNotMatch(page,/\{score\}%/)
})
