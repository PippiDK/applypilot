import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('14-day discovery strategy contains repeated 7-day collection plus a 14-day extension',async()=>{
  const {buildDiscoveryPasses}=await import('./linkedin-discovery-plan.js')
  const passes=buildDiscoveryPasses(14)
  const recent=passes.filter(item=>item.group==='7d')
  const extension=passes.filter(item=>item.group==='14d')

  assert.equal(recent.length,2)
  assert.deepEqual(recent.map(item=>item.days),[7,7])
  assert.equal(extension.length,1)
  assert.equal(extension[0].days,14)
})

test('stable search uses repeated discovery passes and unions job IDs before detail fetches',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/buildDiscoveryPasses/)
  assert.match(source,/collectDiscoveryPasses/)
  assert.match(source,/const rows=discovery\.rows/)
  assert.match(source,/const unique=\[\.\.\.byId\.values\(\)\]/)
})
