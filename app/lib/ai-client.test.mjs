import test from 'node:test'
import assert from 'node:assert/strict'

async function load(){ return import('./ai-client.js').catch(()=>({})) }

const schema={type:'object',additionalProperties:false,properties:{value:{type:'string'}},required:['value']}

test('callStructuredAi passes stage, instructions, input and schema to injected modelCall',async()=>{
  const {callStructuredAi}=await load()
  assert.equal(typeof callStructuredAi,'function')
  let received
  const result=await callStructuredAi({
    stage:'unit_stage',
    instructions:'Return structured data.',
    input:{hello:'world'},
    schema,
    modelCall:async request=>{ received=request; return {value:'ok'} }
  })
  assert.deepEqual(result,{value:'ok'})
  assert.equal(received.stage,'unit_stage')
  assert.deepEqual(received.input,{hello:'world'})
  assert.deepEqual(received.schema,schema)
})

test('callStructuredAi sanitizes provider errors without echoing sensitive input',async()=>{
  const {callStructuredAi}=await load()
  assert.equal(typeof callStructuredAi,'function')
  const secretText='PRIVATE-CV-CONTENT-12345'
  await assert.rejects(
    ()=>callStructuredAi({stage:'job_analysis',instructions:'Analyze.',input:{jd:secretText},schema,modelCall:async()=>{throw new Error(`provider failed with ${secretText}`)}}),
    error=>{
      assert.match(error.message,/job_analysis/i)
      assert.doesNotMatch(error.message,/PRIVATE-CV-CONTENT/)
      return true
    }
  )
})
