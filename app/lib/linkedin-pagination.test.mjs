import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('7-day and 14-day discovery plans include a second LinkedIn page for the deep windows',async()=>{
  const {buildDiscoveryPlan}=await import('./linkedin-discovery-plan.js')
  const queries=['Delivery Manager']
  const seven=buildDiscoveryPlan(queries,7)
  const fourteen=buildDiscoveryPlan(queries,14)
  const key=item=>`${item.days}|${item.start}|${item.query}`
  const sevenKeys=new Set(seven.map(key))
  const fourteenKeys=new Set(fourteen.map(key))

  assert.ok(sevenKeys.has('7|0|Delivery Manager'))
  assert.ok(sevenKeys.has('7|25|Delivery Manager'))
  assert.ok(fourteenKeys.has('14|0|Delivery Manager'))
  assert.ok(fourteenKeys.has('14|25|Delivery Manager'))
  for(const k of sevenKeys) assert.ok(fourteenKeys.has(k),`14-day plan missing ${k}`)
})

test('stable search sends the discovery-plan start offset to LinkedIn instead of hard-coding start=0',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/async \(\{query,seconds,start\}\)=>/)
  assert.match(source,/start:String\(start\)/)
  assert.doesNotMatch(source,/start:'0'/)
})
