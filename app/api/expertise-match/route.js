import {NextResponse} from 'next/server'
import {analyzeExpertiseMatch} from '../../lib/expertise-service.js'
import {resolveManualExpertiseMatch} from '../../lib/expertise-match-server-cache.js'
import {loadLatestNightFlightProfileState} from '../../lib/night-flight-profile-store.js'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'

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
    const rawJob=body?.job&&typeof body.job==='object'?body.job:{}
    const identity=body?.jobIdentity&&typeof body.jobIdentity==='object'?body.jobIdentity:{}
    const job={
      ...identity,
      title:text(rawJob.title),
      company:text(rawJob.company),
      location:text(rawJob.location),
      description:text(rawJob.description)
    }
    const cvText=text(body?.cvText)
    const cvSourceVersion=text(body?.cvSourceVersion)
    const supabase=await createServerSupabaseClient()
    const profileState=await loadLatestNightFlightProfileState({supabase,userId:auth.user.id})
    const result=await resolveManualExpertiseMatch({
      supabase,
      userId:auth.user.id,
      job,
      cvText,
      cvSourceVersion,
      profileState,
      analyze:input=>analyzeExpertiseMatch(input),
    })
    return NextResponse.json({analysis:result.analysis})
  }catch(error){
    const safe=safeExpertiseError(error)
    console.error('expertise-match error',{code:String(error?.code||'AI_UNKNOWN')})
    return NextResponse.json({error:safe.error},{status:safe.status})
  }
}
