function outputTextFromResponse(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim()) return data.output_text.trim()
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==='output_text'&&typeof content.text==='string'&&content.text.trim()) return content.text.trim()
    }
  }
  return ''
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))

function retryAfterMs(response,attempt){
  const raw=String(response?.headers?.get?.('retry-after')??'').trim()
  const seconds=Number(raw)
  if(Number.isFinite(seconds)&&seconds>=0) return Math.min(seconds*1000,30000)
  return Math.min(1000*(2**attempt),30000)
}

async function safeProviderError(response){
  try{ return await response.json() }catch{ return null }
}

function isQuota429(data){
  const type=String(data?.error?.type??'').toLowerCase()
  const code=String(data?.error?.code??'').toLowerCase()
  return type==='insufficient_quota'||code==='insufficient_quota'||code.includes('spend_limit')||code.includes('credit_balance')
}

async function productionModelCall({stage,instructions,input,schema,maxOutputTokens=2400}){
  const apiKey=String(process.env.OPENAI_API_KEY??'').trim()
  if(!apiKey){
    const error=new Error('OpenAI API key is unavailable.')
    error.code='AI_CONFIG_MISSING'
    throw error
  }
  const requestOptions={
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({
      model:process.env.APPLYPILOT_AI_MODEL||'gpt-5.6-sol',
      instructions,
      input:JSON.stringify(input),
      text:{format:{type:'json_schema',name:stage,schema,strict:true}},
      max_output_tokens:maxOutputTokens,
      store:false
    })
  }
  let response
  for(let attempt=0;attempt<3;attempt+=1){
    try{
      response=await fetch('https://api.openai.com/v1/responses',requestOptions)
    }catch(error){
      const networkError=new Error('OpenAI request could not be completed.')
      const name=String(error?.name||'')
      const transportCode=String(error?.code||error?.cause?.code||'')
      const timedOut=name==='AbortError'||name==='TimeoutError'||/TIMEOUT|TIMEDOUT/.test(transportCode)
      networkError.code=timedOut?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK'
      throw networkError
    }
    if(response.ok) break
    if(response.status!==429){
      const error=new Error(`OpenAI request failed with status ${response.status}.`)
      error.code=`AI_PROVIDER_HTTP_${response.status}`
      throw error
    }
    const providerError=await safeProviderError(response)
    if(isQuota429(providerError)){
      const error=new Error('OpenAI quota or spend limit is unavailable.')
      error.code='AI_PROVIDER_QUOTA_EXHAUSTED'
      throw error
    }
    if(attempt===2){
      const error=new Error('OpenAI request failed with status 429.')
      error.code='AI_PROVIDER_HTTP_429'
      throw error
    }
    await sleep(retryAfterMs(response,attempt))
  }
  const data=await response.json()
  if(data?.status==='incomplete'&&data?.incomplete_details?.reason==='max_output_tokens'){
    const error=new Error('OpenAI response reached the output-token limit.')
    error.code='AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS'
    throw error
  }
  const raw=outputTextFromResponse(data)
  if(!raw) throw new Error('OpenAI returned no structured text.')
  return JSON.parse(raw)
}

export async function callStructuredAi({stage,instructions,input,schema,modelCall,maxOutputTokens=2400}){
  const safeStage=String(stage??'ai_stage').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64)||'ai_stage'
  try{
    const call=modelCall||productionModelCall
    const result=await call({stage:safeStage,instructions,input,schema,maxOutputTokens})
    if(!result||typeof result!=='object'||Array.isArray(result)) throw new Error('Invalid structured AI response.')
    return result
  }catch(error){
    const safeError=new Error(`${safeStage} AI stage failed.`)
    if(typeof error?.code==='string'&&/^AI_[A-Z0-9_]+$/.test(error.code)) safeError.code=error.code
    throw safeError
  }
}
