import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {analyzeJob} from '../../lib/tailoring-pipeline.js'
import {deriveTailoringSecret,signTailoringToken} from '../../lib/tailoring-token.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()
const hash=value=>`sha256:${createHash('sha256').update(String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim()).digest('hex')}`

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410})
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    if(body?.action !== 'analyze_job') return NextResponse.json({error:'Unsupported tailoring action.'},{status:400})
    const sourceVersion=text(body?.sourceVersion)
    const job={
      title:text(body?.job?.title),
      company:text(body?.job?.company),
      location:text(body?.job?.location),
      description:text(body?.job?.description)
    }
    if(!sourceVersion) return NextResponse.json({error:'Please Upload Your CV'},{status:400})
    if(!job.title||job.description.length<80) return NextResponse.json({error:'Insufficient job description for safe tailoring.'},{status:400})

    const analysis=await analyzeJob(job)
    const secret=process.env.APPLYPILOT_TAILORING_SECRET||deriveTailoringSecret(process.env.OPENAI_API_KEY)
    const token=signTailoringToken({
      stage:'job_analyzed',
      sourceVersion,
      jobHash:hash(job.description),
      analysis
    },secret)
    return NextResponse.json({stage:'job_analyzed',analysis,token})
  }catch{
    return NextResponse.json({error:'Job analysis failed safely. Please try again.'},{status:502})
  }
}
