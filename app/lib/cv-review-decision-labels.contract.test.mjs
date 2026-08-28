import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('review decision buttons visibly confirm the selected choice',()=>{
  assert.match(page,/decision===ADAPTATION_DECISION\.ORIGINAL\?'✓ Original kept':'Keep original'/)
  assert.match(page,/decision===ADAPTATION_DECISION\.ACCEPTED\?'✓ Accepted':'Accept change'/)
})
