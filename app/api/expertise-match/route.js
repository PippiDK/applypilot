import {NextResponse} from 'next/server'
import {analyzeExpertiseMatch} from '../../lib/expertise-service.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()

function safeExpertiseError(error){
  const code=String(error?.code||'AI_UNKNOWN')
  if(code==='AI_CONFIG_MISSING') return {status:503,error:'OpenAI API key is not configured for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_401') return {status:502,error:'OpenAI API authentication failed for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_429') return {status:502,error:'OpenAI API rate limit reached. Please try again.'}
  if(code==='AI_PROVIDER_HTTP_400') return {status:502,error:'OpenAI rejected the structured Expertise Match request.'}
  if(code==='AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS') return {status:502,error:'OpenAI output limit was reached during Expertise Match analysis. Please try again.'}
  return {status:502,error:'Expertise Match analysis failed safely. Please try again.'}
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const job={
      title:text(body?.job?.title),
      company:text(body?.job?.company),
      location:text(body?.job?.location),
      description:text(body?.job?.description)
    }
    const cvText=text(body?.cvText)
    const analysis=await analyzeExpertiseMatch({job,cvText})
    return NextResponse.json({analysis})
  }catch(error){
    const safe=safeExpertiseError(error)
    console.error('expertise-match error',{code:String(error?.code||'AI_UNKNOWN')})
    return NextResponse.json({error:safe.error},{status:safe.status})
  }
}
