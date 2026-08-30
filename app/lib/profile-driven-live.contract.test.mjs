import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const routePath=new URL('../api/multi-source-search/route.js',import.meta.url)
const adapter=fs.readFileSync(new URL('./linkedin-source-adapter.js',import.meta.url),'utf8')

test('LIVE Search uses the authenticated multi-source endpoint with the saved Union Search Plan',()=>{
  assert.match(page,/\/api\/multi-source-search/)
  assert.match(page,/unionSearchPlan:profile\.unionSearchPlan/)
  assert.match(page,/enabledSources:selectedSources/)
})

test('LinkedIn compatibility fallback remains inside the LinkedIn source adapter',()=>{
  assert.match(adapter,/hasProfilePlan\(unionSearchPlan\)/)
  assert.match(adapter,/buildDiscoverySearchPlan/)
  assert.match(adapter,/searchLinkedInStable/)
})

test('multi-source LIVE endpoint exists separately from the preserved LinkedIn endpoints',()=>{
  assert.equal(fs.existsSync(routePath),true)
})
