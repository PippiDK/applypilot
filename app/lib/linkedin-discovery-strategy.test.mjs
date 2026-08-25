import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDiscoveryPasses } from './linkedin-discovery-plan.js'

test('7-day strategy repeats deep discovery passes so page shuffling can be unioned',()=>{
  const passes=buildDiscoveryPasses(7)
  assert.equal(passes.length,3)
  assert.deepEqual(passes.map(x=>x.group),['7d','7d','7d'])
  assert.deepEqual(passes.map(x=>x.days),[7,7,7])
  assert.deepEqual(passes[0].starts,[0,25,50])
  assert.deepEqual(passes[1].starts,[0,25,50])
  assert.deepEqual(passes[2].starts,[0,25])
})

test('14-day strategy repeats the recent 7-day slice then extends coverage to 14 days without exceeding V4 search-request count',()=>{
  const passes=buildDiscoveryPasses(14)
  assert.deepEqual(passes.map(x=>[x.group,x.days,x.starts]),[
    ['7d',7,[0,25]],
    ['7d',7,[0,25]],
    ['14d',14,[0,25]],
  ])
  const requestsForTenQueries=passes.reduce((sum,pass)=>sum+pass.starts.length*10,0)
  assert.equal(requestsForTenQueries,60)
})

test('7-day multi-pass strategy stays within an 80-request discovery ceiling for ten queries',()=>{
  const passes=buildDiscoveryPasses(7)
  const requests=passes.reduce((sum,pass)=>sum+pass.starts.length*10,0)
  assert.ok(requests<=80,`expected <=80 discovery requests, got ${requests}`)
})
