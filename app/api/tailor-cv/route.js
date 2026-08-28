import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {analyzeJob,mapSelectedCvEvidence,writeProfessionalSummary,writeLatestRoleOverview} from '../../lib/tailoring-pipeline.js'
import {writePreviousRoleOverview} from '../../lib/previous-role-overview.js'
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

function requestSourceCv(value={}){
  return {
    cvId:text(value?.cvId),
    sourceVersion:text(value?.sourceVersion),
    fileName:text(value?.fileName),
    cvText:raw(value?.cvText)
  }
}

function tailoringSecret(){
  return process.env.APPLYPILOT_TAILORING_SECRET||deriveTailoringSecret(process.env.OPENAI_API_KEY)
}

function validateSelectedCvRequest({job,sourceCv}){
  if(!job.title||job.description.length<80) return 'Insufficient job description for safe tailoring.'
  if(!sourceCv.cvId||!sourceCv.sourceVersion||!sourceCv.fileName||sourceCv.cvText.trim().length<100) return 'A complete selected CV is required for adaptation.'
  return ''
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
      const sourceCv=requestSourceCv(body?.sourceCv)
      const requestError=validateSelectedCvRequest({job,sourceCv})
      if(requestError) return NextResponse.json({error:requestError},{status:400})

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

    if(action==='write_professional_summary'){
      const job=requestJob(body?.job)
      const sourceCv=requestSourceCv(body?.sourceCv)
      const requestError=validateSelectedCvRequest({job,sourceCv})
      if(requestError) return NextResponse.json({error:requestError},{status:400})

      let tokenPayload
      try{ tokenPayload=verifyTailoringToken(body?.token,secret) }
      catch(error){ return NextResponse.json({error:error.message||'Invalid tailoring token.'},{status:400}) }
      if(tokenPayload?.stage!=='evidence_mapped') return NextResponse.json({error:'Tailoring stage is not ready for Professional Summary writing.'},{status:400})
      if(text(tokenPayload?.jobId)&&text(tokenPayload.jobId)!==jobId(job)) return NextResponse.json({error:'Selected CV binding does not match the analysed vacancy.'},{status:400})
      try{ verifySelectedCvBinding({tokenPayload,sourceCv,jobHash:hash(job.description)}) }
      catch(error){ return NextResponse.json({error:error.message||'Selected CV binding failed safely.'},{status:400}) }

      const structure=detectCvStructure(sourceCv.cvText)
      const block=await writeProfessionalSummary({analysis:tokenPayload.analysis,evidence:tokenPayload.evidence,structure})
      const token=signTailoringToken({
        stage:'summary_written',
        cvId:sourceCv.cvId,
        sourceVersion:sourceCv.sourceVersion,
        jobId:jobId(job),
        jobHash:hash(job.description),
        analysis:tokenPayload.analysis,
        evidence:tokenPayload.evidence,
        block
      },secret)
      return NextResponse.json({stage:'summary_written',block,token})
    }

    if(action==='write_latest_role_overview'){
      const job=requestJob(body?.job)
      const sourceCv=requestSourceCv(body?.sourceCv)
      const requestError=validateSelectedCvRequest({job,sourceCv})
      if(requestError) return NextResponse.json({error:requestError},{status:400})

      let tokenPayload
      try{ tokenPayload=verifyTailoringToken(body?.token,secret) }
      catch(error){ return NextResponse.json({error:error.message||'Invalid tailoring token.'},{status:400}) }
      if(tokenPayload?.stage!=='summary_written') return NextResponse.json({error:'Tailoring stage is not ready for latest role overview writing.'},{status:400})
      if(text(tokenPayload?.jobId)&&text(tokenPayload.jobId)!==jobId(job)) return NextResponse.json({error:'Selected CV binding does not match the analysed vacancy.'},{status:400})
      try{ verifySelectedCvBinding({tokenPayload,sourceCv,jobHash:hash(job.description)}) }
      catch(error){ return NextResponse.json({error:error.message||'Selected CV binding failed safely.'},{status:400}) }

      const structure=detectCvStructure(sourceCv.cvText)
      const latestRoleOverview=await writeLatestRoleOverview({analysis:tokenPayload.analysis,evidence:tokenPayload.evidence,structure})
      const blocks={professionalSummary:tokenPayload.block,latestRoleOverview}
      const token=signTailoringToken({
        stage:'latest_role_written',
        cvId:sourceCv.cvId,
        sourceVersion:sourceCv.sourceVersion,
        jobId:jobId(job),
        jobHash:hash(job.description),
        analysis:tokenPayload.analysis,
        evidence:tokenPayload.evidence,
        blocks
      },secret)
      return NextResponse.json({stage:'latest_role_written',blocks,token})
    }

    if(action==='write_previous_role_overview'){
      const job=requestJob(body?.job)
      const sourceCv=requestSourceCv(body?.sourceCv)
      const requestError=validateSelectedCvRequest({job,sourceCv})
      if(requestError) return NextResponse.json({error:requestError},{status:400})

      let tokenPayload
      try{ tokenPayload=verifyTailoringToken(body?.token,secret) }
      catch(error){ return NextResponse.json({error:error.message||'Invalid tailoring token.'},{status:400}) }
      if(tokenPayload?.stage!=='latest_role_written') return NextResponse.json({error:'Tailoring stage is not ready for previous role overview writing.'},{status:400})
      if(text(tokenPayload?.jobId)&&text(tokenPayload.jobId)!==jobId(job)) return NextResponse.json({error:'Selected CV binding does not match the analysed vacancy.'},{status:400})
      try{ verifySelectedCvBinding({tokenPayload,sourceCv,jobHash:hash(job.description)}) }
      catch(error){ return NextResponse.json({error:error.message||'Selected CV binding failed safely.'},{status:400}) }

      const structure=detectCvStructure(sourceCv.cvText)
      const previousRoleOverview=await writePreviousRoleOverview({analysis:tokenPayload.analysis,evidence:tokenPayload.evidence,structure})
      const blocks={...(tokenPayload.blocks||{}),previousRoleOverview}
      const token=signTailoringToken({
        stage:'previous_role_written',
        cvId:sourceCv.cvId,
        sourceVersion:sourceCv.sourceVersion,
        jobId:jobId(job),
        jobHash:hash(job.description),
        analysis:tokenPayload.analysis,
        evidence:tokenPayload.evidence,
        blocks
      },secret)
      return NextResponse.json({stage:'previous_role_written',blocks,token})
    }

    return NextResponse.json({error:'Unsupported tailoring action.'},{status:400})
  }catch{
    const error=action==='map_selected_cv_evidence'
      ?'Selected CV evidence mapping failed safely. Please try again.'
      :action==='write_professional_summary'
        ?'Professional Summary writing failed safely. Please try again.'
        :action==='write_latest_role_overview'
          ?'Latest role overview writing failed safely. Please try again.'
          :action==='write_previous_role_overview'
            ?'Previous role overview writing failed safely. Please try again.'
            :'Job analysis failed safely. Please try again.'
    return NextResponse.json({error},{status:502})
  }
}
