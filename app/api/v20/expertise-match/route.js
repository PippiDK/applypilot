import {NextResponse} from 'next/server'
import {requireUser} from '../../../lib/auth/require-user.js'
import {analyzeExpertiseMatch} from '../../../lib/expertise-service.js'
import {normalizeBrowserRecord} from '../../../lib/v20-browser-import.js'
export const dynamic='force-dynamic'
export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json()
    const job=normalizeBrowserRecord({...body?.job,jobId:body?.job?.sourceJobId||body?.job?.jobId,url:body?.job?.originalUrl||body?.job?.url,fullJd:body?.job?.fullJd||body?.job?.description})
    const cvText=String(body?.cvText??'').trim()
    if(cvText.length<100||cvText.length>100000) return NextResponse.json({error:'A ready Source CV is required.'},{status:400})
    const analysis=await analyzeExpertiseMatch({job:{title:job.title,company:job.company,location:job.location,description:job.description},cvText})
    return NextResponse.json({analysis,jdIncomplete:job.needsJdReview})
  }catch(error){
    if(/Invalid|required|match LinkedIn|URL/.test(String(error?.message))) return NextResponse.json({error:'Invalid Collector record.'},{status:400})
    console.error('v20 expertise match failed',{code:String(error?.code||'AI_UNKNOWN')})
    return NextResponse.json({error:'v20 AI Matching unavailable. No result was saved.'},{status:502})
  }
}
