import test from 'node:test'
import assert from 'node:assert/strict'
import {validateSearchQueryExpansions,buildSearchQueryExpansions,buildExpandedSearchPlan} from './search-query-expansion-ai.js'

test('normalizes, removes exact and duplicate queries, and caps each role at three',()=>{
  const result=validateSearchQueryExpansions({expansions:[
    {sourceRole:'Senior IT Delivery Manager',queries:['IT Delivery Manager','delivery manager','Delivery Manager','Senior IT Delivery Manager','Technology Delivery Manager']}
  ]},['Senior IT Delivery Manager'])
  assert.deepEqual(result,[{sourceRole:'Senior IT Delivery Manager',queries:['IT Delivery Manager','delivery manager','Technology Delivery Manager']}])
})

test('is domain agnostic and preserves creative role family output',()=>{
  const result=validateSearchQueryExpansions({expansions:[
    {sourceRole:'Senior Concept Artist',queries:['Concept Artist','Digital Artist']}
  ]},['Senior Concept Artist'])
  assert.deepEqual(result,[{sourceRole:'Senior Concept Artist',queries:['Concept Artist','Digital Artist']}])
})

test('builds expansions in one structured AI call',async()=>{
  let calls=0
  const result=await buildSearchQueryExpansions({roles:['Integration Project Manager','Senior Concept Artist'],modelCall:async args=>{
    calls++
    assert.deepEqual(args.input.roles,['Integration Project Manager','Senior Concept Artist'])
    return {expansions:[
      {sourceRole:'Integration Project Manager',queries:['Integration Manager','Implementation Manager']},
      {sourceRole:'Senior Concept Artist',queries:['Concept Artist']}
    ]}
  }})
  assert.equal(calls,1)
  assert.equal(result[0].queries.includes('Implementation Manager'),true)
})

test('builds exact plus expanded directions without changing the source role',()=>{
  const plan={directions:[{key:'integration project manager',role:'Integration Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const expanded=buildExpandedSearchPlan(plan,[{sourceRole:'Integration Project Manager',queries:['Implementation Manager']}])
  assert.equal(expanded.directions.length,2)
  assert.deepEqual(expanded.directions.map(x=>({role:x.role,query:x.query,mode:x.discoveryMode})),[
    {role:'Integration Project Manager',query:'Integration Project Manager',mode:'exact'},
    {role:'Integration Project Manager',query:'Implementation Manager',mode:'expanded'}
  ])
})

test('falls back to exact-only discovery when expansion fails',async()=>{
  const {buildDiscoverySearchPlan}=await import('./search-query-expansion-ai.js')
  const plan={directions:[{key:'senior concept artist',role:'Senior Concept Artist',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const result=await buildDiscoverySearchPlan({unionSearchPlan:plan,queryExpander:async()=>{throw new Error('provider down')}})
  assert.deepEqual(result.directions.map(x=>[x.role,x.query,x.discoveryMode]),[['Senior Concept Artist','Senior Concept Artist','exact']])
})
