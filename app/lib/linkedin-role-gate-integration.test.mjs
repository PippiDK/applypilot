import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('stable search applies a title role gate before JD fetch and a full role gate before scoring',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/from '\.\/linkedin-role-gate\.js'/)
  assert.match(source,/classifyRoleTitle/)
  assert.match(source,/roleGate/)
  assert.match(source,/roleGateRejectedBeforeDetail/)
  assert.match(source,/roleGateRejectedAfterDetail/)
  assert.match(source,/const detailCandidates=/)
})
