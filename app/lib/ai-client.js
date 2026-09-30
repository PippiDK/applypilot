const QUOTA_429_CODES=new Set(['credit_balance_exhausted','organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded','insufficient_quota'])

const cleanProviderValue=value=>String(value??'').trim().toLowerCase()

function retryAfterMs(response){
  const header=name=>response?.headers&&typeof response.headers.get==='function'?response.headers.get(name):null
  const retry=String(header('retry-after')??'').trim()
  if(retry){
    const seconds=Number(retry)
    if(Number.isFinite(seconds)&&seconds>=0) return Math.round(seconds*1000)
    const at=Date.parse(retry)
    if(Number.isFinite(at)) return Math.max(0,at-Date.now())
  }
  const parseReset=value=>{
    const raw=String(value??'').trim().toLowerCase()
    if(!raw) return null
    if(/^\d+(?:\.\d+)?$/.test(raw)) return Math.round(Number(raw)*1000)
    let total=0,matched=false
    for(const part of raw.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)){
      const amount=Number(part[1]),unit=part[2]
      if(!Number.isFinite(amount)) continue
      matched=true
      total+=amount*(unit==='ms'?1:unit==='s'?1000:unit==='m'?60000:3600000)
    }
    return matched?Math.round(total):null
  }
  const resets=[parseReset(header('x-ratelimit-reset-requests')),parseReset(header('x-ratelimit-reset-tokens'))]
    .filter(value=>Number.isFinite(value)&&value>=0)
  return resets.length?Math.max(...resets):null
}

function classify429(response,data){
  const code=cleanProviderValue(data?.error?.code)
  const type=cleanProviderValue(data?.error?.type)
  return {
    kind:QUOTA_429_CODES.has(code)||type==='insufficient_quota'?'quota':'rate_limit',
    retryAfterMs:retryAfterMs(response),
  }
}

function outputTextFromResponse(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim()) return data.output_text.trim()
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==='output_text'&&typeof content.text==='string'&&content.text.trim()) return content.text.trim()
    }
  }
  return ''
}

async function productionModelCall({stage,instructions,input,schema,maxOutputTokens=2400}){
  const apiKey=String(process.env.OPENAI_API_KEY??'').trim()
  if(!apiKey){
    const error=new Error('OpenAI API key is unavailable.')
    error.code='AI_CONFIG_MISSING'
    throw error
  }
  let response
  try{
    response=await fetch('https://api.openai.com/v1/responses',{
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
    })
  }catch(error){
    const networkError=new Error('OpenAI request could not be completed.')
    const name=String(error?.name||'')
    const transportCode=String(error?.code||error?.cause?.code||'')
    const timedOut=name==='AbortError'||name==='TimeoutError'||/TIMEOUT|TIMEDOUT/.test(transportCode)
    networkError.code=timedOut?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK'
    throw networkError
  }
  if(!response.ok){
    let provider429=null
    if(response.status===429){
      let data=null
      try{data=await response.json()}catch{}
      provider429=classify429(response,data)
    }
    const error=new Error(`OpenAI request failed with status ${response.status}.`)
    error.code=`AI_PROVIDER_HTTP_${response.status}`
    if(provider429){
      error.provider429Kind=provider429.kind
      if(Number.isFinite(provider429.retryAfterMs)) error.retryAfterMs=provider429.retryAfterMs
    }
    throw error
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
    if(safeError.code==='AI_PROVIDER_HTTP_429'){
      if(error?.provider429Kind==='quota'||error?.provider429Kind==='rate_limit') safeError.provider429Kind=error.provider429Kind
      const wait=Number(error?.retryAfterMs)
      if(Number.isFinite(wait)&&wait>=0) safeError.retryAfterMs=Math.min(wait,10*60*1000)
    }
    throw safeError
  }
}
