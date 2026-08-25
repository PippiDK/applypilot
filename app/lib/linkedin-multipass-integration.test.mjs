import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('stable search uses multi-pass union discovery instead of a one-shot discovery plan',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/collectDiscoveryPasses/)
  assert.match(source,/buildDiscoveryPasses/)
  assert.match(source,/fetchPage:async/)
  assert.doesNotMatch(source,/const discoveryPlan\s*=\s*buildDiscoveryPlan/)
  assert.doesNotMatch(source,/mapLimit\(discoveryPlan/)
})

test('stable search exposes discovery pass diagnostics so live testing can tell whether LinkedIn actually converged',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/discoveryPasses/)
  assert.match(source,/discoveryGroups/)
})
