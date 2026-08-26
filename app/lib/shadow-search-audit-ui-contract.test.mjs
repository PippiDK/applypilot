import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('shadow audit is explicitly diagnostic and renders discovery delta provenance',async()=>{
  const source=await readFile(new URL('../components/shadow-search-audit.js',import.meta.url),'utf8')
  assert.match(source,/SHADOW SEARCH/)
  assert.match(source,/no effect on Live matches/)
  assert.match(source,/Directions/)
  assert.match(source,/New candidates/)
  assert.match(source,/Primary/)
  assert.match(source,/Adjacent-only/)
  assert.match(source,/FOUND BY/)
  assert.match(source,/newCandidates/)
})
