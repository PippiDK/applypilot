import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {analyzeJob,mapSelectedCvEvidence} from '../../lib/tailoring-pipeline.js'
import {detectCvStructure} from '../../lib/cv-sections.js'
import {verifySelectedCvBinding} from '../../lib/evidence-guard.js'
import {deriveTailoringSecret,signTailoringToken,verifyTailoringToken} from '../../lib/tailoring-token.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()
const raw=value=>String(value??'')
const hash=value=>`sha256:${createHash('sha256').update(String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim()).digest('hex')}`
const jobId=job=>text(job?.sourceJobId)||([text(job?.title),text(job?.company)].every(Boolean)?`${text(job?.title)}|${text(job?.company)}`:'')

function requestJob(value={}){
  return {
    sourceJobId:text(value?.sourceJobId),
    title:text(value?.title),
    company:text(value?.company),
    location:text(value?.location),
    description:text(value?.description)
  }
}

function tailoringSecret(){
  return process.env.APPLYPILOT_TAILORING_SECRET||deriveTailoringSecret(process.env.OPENAI_API_KEY)
}

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410})
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  let action=''
  try{
    const body=await request.json()
    action=text(body?.action)
    const secret=tailoringSecret()

    if(action==='analyze_job'){
      const sourceVersion=text(body?.sourceVersion)
      const cvId=text(body?.cvId)
      const job=requestJob(body?.job)
      if(!sourceVersion) return NextResponse.json({error:'Please Upload Your CV'},{status:400})
      if(!job.title||job.description.length<80) return NextResponse.json({error:'Insufficient job description for safe tailoring.'},{status:400})

      const analysis=await analyzeJob(job)
      const token=signTailoringToken({
        stage:'job_analyzed',
        ...(cvId?{cvId}:{}),
        sourceVersion,
        jobId:jobId(job),
        jobHash:hash(job.description),
        analysis
      },secret)
      return NextResponse.json({stage:'job_analyzed',analysis,token})
    }

    if(action==='map_selected_cv_evidence'){
      const job=requestJob(body?.job)
      const sourceCv={
        cvId:text(body?.sourceCv?.cvId),
        sourceVersion:text(body?.sourceCv?.sourceVersion),
        fileName:text(body?.sourceCv?.fileName),
        cvText:raw(body?.sourceCv?.cvText)
      }
      if(!job.title||job.description.length<80) return NextResponse.json({error:'Insufficient job description for safe tailoring.'},{status:400})
      if(!sourceCv.cvId||!sourceCv.sourceVersion||!sourceCv.fileName||sourceCv.cvText.trim().length<100) return NextResponse.json({error:'A complete selected CV is required for adaptation.'},{status:400})

      let tokenPayload
      try{ tokenPayload=verifyTailoringToken(body?.token,secret) }
      catch(error){ return NextResponse.json({error:error.message||'Invalid tailoring token.'},{status:400}) }
      if(tokenPayload?.stage!=='job_analyzed') return NextResponse.json({error:'Tailoring stage is not ready for selected CV evidence mapping.'},{status:400})
      if(text(tokenPayload?.jobId)&&text(tokenPayload.jobId)!==jobId(job)) return NextResponse.json({error:'Selected CV binding does not match the analysed vacancy.'},{status:400})
      try{ verifySelectedCvBinding({tokenPayload,sourceCv,jobHash:hash(job.description)}) }
      catch(error){ return NextResponse.json({error:error.message||'Selected CV binding failed safely.'},{status:400}) }

      const structure=detectCvStructure(sourceCv.cvText)
      const evidence=await mapSelectedCvEvidence({analysis:tokenPayload.analysis,sourceCv,structure})
      const token=signTailoringToken({
        stage:'evidence_mapped',
        cvId:sourceCv.cvId,
        sourceVersion:sourceCv.sourceVersion,
        jobId:jobId(job),
        jobHash:hash(job.description),
        analysis:tokenPayload.analysis,
        evidence
      },secret)
      return NextResponse.json({stage:'evidence_mapped',analysis:tokenPayload.analysis,evidence,structure,token})
    }

    return NextResponse.json({error:'Unsupported tailoring action.'},{status:400})
  }catch{
    const error=action==='map_selected_cv_evidence'?'Selected CV evidence mapping failed safely. Please try again.':'Job analysis failed safely. Please try again.'
    return NextResponse.json({error},{status:502})
  }
}
