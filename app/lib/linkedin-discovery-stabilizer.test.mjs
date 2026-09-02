import test from 'node:test'
import assert from 'node:assert/strict'
import { collectDiscoveryPasses } from './linkedin-discovery-stabilizer.js'

const row=id=>({jobId:String(id),title:`Job ${id}`})

test('multi-pass discovery unions reshuffled LinkedIn pages until a clean pass adds no new job IDs',async()=>{
  const passes=[
    {group:'7d',days:7,starts:[0,25],label:'7d-pass-1'},
    {group:'7d',days:7,starts:[0,25],label:'7d-pass-2'},
    {group:'7d',days:7,starts:[0,25],label:'7d-pass-3'},
    {group:'7d',days:7,starts:[0,25],label:'7d-pass-4'},
  ]
  const pages=new Map([
    ['7d-pass-1|0',['A','B','C']],
    ['7d-pass-1|25',['B','C','D']],
    ['7d-pass-2|0',['B','A','E']],
    ['7d-pass-2|25',['C','D','F']],
    ['7d-pass-3|0',['F','A','B']],
    ['7d-pass-3|25',['C','D','E']],
    ['7d-pass-4|0',['A','B','E']],
    ['7d-pass-4|25',['C','D','F']],
  ])
  const calls=[]
  const result=await collectDiscoveryPasses({
    queries:['Delivery Manager'],
    passes,
    fetchPage:async meta=>{
      calls.push(`${meta.label}|${meta.start}`)
      return (pages.get(`${meta.label}|${meta.start}`)||[]).map(row)
    },
  })

  assert.deepEqual(new Set(result.rows.map(x=>x.jobId)),new Set(['A','B','C','D','E','F']))
  assert.equal(result.groups['7d'].stable,true)
  assert.equal(result.groups['7d'].passesExecuted,4)
  assert.equal(result.passStats[0].newJobIds,4)
  assert.equal(result.passStats[1].newJobIds,2)
  assert.equal(result.passStats[2].newJobIds,0)
  assert.equal(result.passStats[3].newJobIds,0)
  assert.equal(calls.some(x=>x.startsWith('7d-pass-4')),true)
})

test('a failed discovery request cannot falsely mark a pass stable',async()=>{
  const passes=[
    {group:'7d',days:7,starts:[0],label:'7d-pass-1'},
    {group:'7d',days:7,starts:[0],label:'7d-pass-2'},
  ]
  let call=0
  const result=await collectDiscoveryPasses({
    queries:['Delivery Manager'],
    passes,
    fetchPage:async()=>{
      call++
      if(call===2) throw new Error('LinkedIn HTTP 429')
      return [row('A')]
    },
  })

  assert.equal(result.groups['7d'].stable,false)
  assert.equal(result.searchFailures,1)
  assert.match(result.errors[0],/429/)
})
