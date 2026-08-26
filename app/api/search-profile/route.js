import {NextResponse} from 'next/server'
import {buildSearchProfileRoles,buildSearchProfileExclusions} from '../../lib/search-profile-ai.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()

function safeError(error){
  const code=String(error?.code||'AI_UNKNOWN')
  if(code==='AI_CONFIG_MISSING') return {status:503,error:'OpenAI API key is not configured for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_401') return {status:502,error:'OpenAI API authentication failed for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_429') return {status:502,error:'OpenAI API rate limit reached. Please try again.'}
  if(code==='AI_PROVIDER_HTTP_400') return {status:502,error:'OpenAI rejected the structured Search Profile request.'}
  return {status:502,error:'Search Profile generation failed safely. Please try again.'}
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    if(body?.mode==='exclusions'){
      const exclusions=await buildSearchProfileExclusions({exclusionsText:text(body?.exclusionsText)})
      return NextResponse.json({exclusions})
    }
    const roles=await buildSearchProfileRoles({cvText:text(body?.cvText)})
    return NextResponse.json({roles})
  }catch(error){
    const safe=safeError(error)
    console.error('search-profile error',{code:String(error?.code||'AI_UNKNOWN')})
    return NextResponse.json({error:safe.error},{status:safe.status})
  }
}
