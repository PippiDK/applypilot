import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('14-day discovery plan is a structural superset of the 7-day plan',async()=>{
  const {buildDiscoveryPlan}=await import('./linkedin-discovery-plan.js')
  const queries=['Delivery Manager','Technical Project Manager']
  const seven=buildDiscoveryPlan(queries,7)
  const fourteen=buildDiscoveryPlan(queries,14)
  const keys=items=>new Set(items.map(item=>`${item.days}|${item.query}`))
  const fourteenKeys=keys(fourteen)
  for(const key of keys(seven)) assert.ok(fourteenKeys.has(key),`14-day plan missing ${key}`)
  assert.deepEqual([...new Set(seven.map(item=>item.days))],[1,3,7])
  assert.deepEqual([...new Set(fourteen.map(item=>item.days))],[1,3,7,14])
})

test('stable search uses the cumulative discovery plan instead of one broad LinkedIn window',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/buildDiscoveryPlan/)
  assert.match(source,/const discoveryPlan\s*=\s*buildDiscoveryPlan\(DISCOVERY_QUERIES,freshnessDays\)/)
  assert.match(source,/mapLimit\(discoveryPlan,5,async \(\{query,seconds\}\)=>/)
})
