import test from 'node:test'
import assert from 'node:assert/strict'

async function load(){ return import('./ai-client.js').catch(()=>({})) }
const schema={type:'object',additionalProperties:false,properties:{value:{type:'string'}},required:['value']}

test('production AI path retries temporary 429 after Retry-After and then succeeds',async()=>{
  const {callStructuredAi}=await load()
  const previousKey=process.env.OPENAI_API_KEY
  const previousFetch=globalThis.fetch
  process.env.OPENAI_API_KEY='sk-test-not-real'
  let calls=0
  globalThis.fetch=async()=>{
    calls+=1
    if(calls===1){
      return {
        ok:false,
        status:429,
        headers:{get:name=>name.toLowerCase()==='retry-after'?'0':null},
        json:async()=>({error:{type:'rate_limit_error',code:'rate_limit_exceeded'}}),
      }
    }
    return {ok:true,json:async()=>({status:'completed',output_text:'{"value":"ok"}'})}
  }
  try{
    const result=await callStructuredAi({stage:'expertise_match_one_pass',instructions:'Analyze.',input:{jd:'safe'},schema})
    assert.deepEqual(result,{value:'ok'})
    assert.equal(calls,2)
  }finally{
    globalThis.fetch=previousFetch
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previousKey
  }
})

test('production AI path does not retry quota-style 429 and preserves safe terminal code',async()=>{
  const {callStructuredAi}=await load()
  const previousKey=process.env.OPENAI_API_KEY
  const previousFetch=globalThis.fetch
  process.env.OPENAI_API_KEY='sk-test-not-real'
  let calls=0
  globalThis.fetch=async()=>{
    calls+=1
    return {
      ok:false,
      status:429,
      headers:{get:()=>null},
      json:async()=>({error:{type:'insufficient_quota',code:'insufficient_quota'}}),
    }
  }
  try{
    await assert.rejects(
      ()=>callStructuredAi({stage:'expertise_match_one_pass',instructions:'Analyze.',input:{jd:'safe'},schema}),
      error=>{assert.equal(error.code,'AI_PROVIDER_QUOTA_EXHAUSTED'); return true}
    )
    assert.equal(calls,1)
  }finally{
    globalThis.fetch=previousFetch
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=previousKey
  }
})
