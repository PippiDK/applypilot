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
  const response=await fetch('https://api.openai.com/v1/responses',{
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
  if(!response.ok){
    const error=new Error(`OpenAI request failed with status ${response.status}.`)
    error.code=`AI_PROVIDER_HTTP_${response.status}`
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

function safeAiFailureCode(error){
  const code=String(error?.code||'').trim()
  if(/^AI_[A-Z0-9_]+$/.test(code)) return code

  const causeCode=String(error?.cause?.code||'').trim()
  const name=String(error?.name||'').trim()
  if(name==='AbortError'||name==='TimeoutError'||/TIMEOUT/.test(code)||/TIMEOUT/.test(causeCode)){
    return 'AI_PROVIDER_TIMEOUT'
  }
  if(error instanceof TypeError||/^(ECONN|ENET|EAI_AGAIN|ENOTFOUND|UND_ERR_)/.test(code||causeCode)){
    return 'AI_PROVIDER_NETWORK'
  }
  return ''
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
    const code=safeAiFailureCode(error)
    if(code) safeError.code=code
    throw safeError
  }
}
