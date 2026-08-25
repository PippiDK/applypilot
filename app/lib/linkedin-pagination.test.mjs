import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stableSearchUrl=new URL('./linkedin-stable-search.js',import.meta.url)

test('7-day strategy includes deeper LinkedIn offsets and 14-day strategy keeps a bounded second page',async()=>{
  const {buildDiscoveryPasses}=await import('./linkedin-discovery-plan.js')
  const seven=buildDiscoveryPasses(7)
  const fourteen=buildDiscoveryPasses(14)

  assert.ok(seven.slice(0,2).every(pass=>pass.starts.includes(0)&&pass.starts.includes(25)&&pass.starts.includes(50)))
  assert.deepEqual(seven[2].starts,[0,25])
  assert.ok(fourteen.every(pass=>pass.starts.includes(0)&&pass.starts.includes(25)))
})

test('stable search sends each discovery-pass start offset to LinkedIn instead of hard-coding start=0',async()=>{
  const source=await readFile(stableSearchUrl,'utf8')
  assert.match(source,/fetchPage:async \(\{query,seconds,start\}\)=>/)
  assert.match(source,/start:String\(start\)/)
  assert.doesNotMatch(source,/start:'0'/)
})
