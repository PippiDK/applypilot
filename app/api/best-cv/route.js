import {NextResponse} from 'next/server'
import {analyzeBestCv} from '../../lib/best-cv-selector.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()

function safeBestCvError(error){
  const code=String(error?.code||'AI_UNKNOWN')
  if(code==='AI_CONFIG_MISSING') return {status:503,error:'OpenAI API key is not configured for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_401') return {status:502,error:'OpenAI API authentication failed for this deployment.'}
  if(code==='AI_PROVIDER_HTTP_429') return {status:502,error:'OpenAI API rate limit reached. Please try again.'}
  if(code==='AI_PROVIDER_HTTP_400') return {status:502,error:'OpenAI rejected the structured Best CV request.'}
  if(code==='AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS') return {status:502,error:'OpenAI output limit was reached during Best CV analysis. Please try again.'}
  return {status:502,error:'Best CV analysis failed safely. Please try again.'}
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const job={
      sourceJobId:text(body?.job?.sourceJobId),
      title:text(body?.job?.title),
      company:text(body?.job?.company),
      location:text(body?.job?.location),
      description:text(body?.job?.description)
    }
    const cvs=(Array.isArray(body?.cvs)?body.cvs:[]).slice(0,3).map(cv=>({
      id:text(cv?.id),
      slot:Number(cv?.slot),
      fileName:text(cv?.fileName),
      sourceVersion:text(cv?.sourceVersion),
      cvText:text(cv?.cvText),
      summary:text(cv?.summary),
      skills:Array.isArray(cv?.skills)?cv.skills.map(text).filter(Boolean).slice(0,100):[]
    }))
    const analysis=await analyzeBestCv({job,cvs})
    return NextResponse.json({analysis})
  }catch(error){
    const safe=safeBestCvError(error)
    console.error('best-cv error',{code:String(error?.code||'AI_UNKNOWN')})
    return NextResponse.json({error:safe.error},{status:safe.status})
  }
}
