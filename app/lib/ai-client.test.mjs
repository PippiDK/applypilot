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

test('callStructuredAi preserves a safe provider failure code without leaking provider details',async()=>{
  const {callStructuredAi}=await load()
  const providerError=new Error('provider rejected PRIVATE-JD-CONTENT')
  providerError.code='AI_PROVIDER_HTTP_400'
  await assert.rejects(
    ()=>callStructuredAi({stage:'expertise_requirements',instructions:'Analyze.',input:{jd:'PRIVATE-JD-CONTENT'},schema,modelCall:async()=>{throw providerError}}),
    error=>{
      assert.equal(error.code,'AI_PROVIDER_HTTP_400')
      assert.match(error.message,/expertise_requirements AI stage failed/i)
      assert.doesNotMatch(error.message,/PRIVATE-JD-CONTENT/)
      return true
    }
  )
})

test('production AI path classifies missing API configuration safely',async()=>{
  const {callStructuredAi}=await load()
  const previous=process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try{
    await assert.rejects(
      ()=>callStructuredAi({stage:'expertise_requirements',instructions:'Analyze.',input:{jd:'safe'},schema}),
      error=>{assert.equal(error.code,'AI_CONFIG_MISSING'); return true}
    )
  }finally{
    if(previous===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previous
  }
})

test('production AI path classifies provider HTTP status without exposing response body',async()=>{
  const {callStructuredAi}=await load()
  const previousKey=process.env.OPENAI_API_KEY
  const previousFetch=globalThis.fetch
  process.env.OPENAI_API_KEY='sk-test-not-real'
  globalThis.fetch=async()=>({ok:false,status:400,text:async()=>'{"error":{"message":"PRIVATE PROVIDER DETAIL"}}'})
  try{
    await assert.rejects(
      ()=>callStructuredAi({stage:'expertise_requirements',instructions:'Analyze.',input:{jd:'safe'},schema}),
      error=>{
        assert.equal(error.code,'AI_PROVIDER_HTTP_400')
        assert.doesNotMatch(error.message,/PRIVATE PROVIDER DETAIL/)
        return true
      }
    )
  }finally{
    globalThis.fetch=previousFetch
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previousKey
  }
})

test('production AI path uses the caller-specific output-token budget',async()=>{
  const {callStructuredAi}=await load()
  const previousKey=process.env.OPENAI_API_KEY
  const previousFetch=globalThis.fetch
  let body
  process.env.OPENAI_API_KEY='sk-test-not-real'
  globalThis.fetch=async(_url,options)=>{
    body=JSON.parse(options.body)
    return {ok:true,json:async()=>({status:'completed',output_text:'{"value":"ok"}'})}
  }
  try{
    const result=await callStructuredAi({stage:'expertise_requirements',instructions:'Analyze.',input:{jd:'safe'},schema,maxOutputTokens:12000})
    assert.deepEqual(result,{value:'ok'})
    assert.equal(body.max_output_tokens,12000)
  }finally{
    globalThis.fetch=previousFetch
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previousKey
  }
})

test('production AI path classifies max-output-token incomplete responses safely',async()=>{
  const {callStructuredAi}=await load()
  const previousKey=process.env.OPENAI_API_KEY
  const previousFetch=globalThis.fetch
  process.env.OPENAI_API_KEY='sk-test-not-real'
  globalThis.fetch=async()=>({ok:true,json:async()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]})})
  try{
    await assert.rejects(
      ()=>callStructuredAi({stage:'expertise_requirements',instructions:'Analyze.',input:{jd:'safe'},schema,maxOutputTokens:12000}),
      error=>{assert.equal(error.code,'AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS'); return true}
    )
  }finally{
    globalThis.fetch=previousFetch
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previousKey
  }
})
