import test from 'node:test'
import assert from 'node:assert/strict'
import {runLabeledSearchTask} from './search-task-label.js'

test('labeled search task preserves successful results',async()=>{
  const result=await runLabeledSearchTask('LinkedIn',async()=>({ok:true}))
  assert.deepEqual(result,{ok:true})
})

test('labeled search task prefixes source diagnostics without retrying',async()=>{
  let calls=0
  await assert.rejects(
    runLabeledSearchTask('Company Watch batch 3 (Vestas, DSV, NKT, Tryg)',async()=>{
      calls+=1
      throw new TypeError('Failed to fetch')
    }),
    /Company Watch batch 3 \(Vestas, DSV, NKT, Tryg\): Failed to fetch/
  )
  assert.equal(calls,1)
})
