import {NextResponse} from 'next/server'
import {writeCvAdaptation} from '../../lib/direct-cv-adaptation.js'
import {detectCvStructure} from '../../lib/cv-sections.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()
const raw=value=>String(value??'')

function requestJob(value={}){
  return {sourceJobId:text(value?.sourceJobId),title:text(value?.title),company:text(value?.company),location:text(value?.location),description:text(value?.description)}
}

function requestSourceCv(value={}){
  return {cvId:text(value?.cvId),sourceVersion:text(value?.sourceVersion),fileName:text(value?.fileName),cvText:raw(value?.cvText)}
}

function validateSelectedCvRequest({job,sourceCv}){
  if(!job.title||job.description.length<80) return 'A usable vacancy is required for adaptation.'
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

  try{
    const body=await request.json()
    const action=text(body?.action)
    if(action!=='adapt_cv') return NextResponse.json({error:'Unsupported tailoring action.'},{status:400})

    const job=requestJob(body?.job)
    const sourceCv=requestSourceCv(body?.sourceCv)
    const requestError=validateSelectedCvRequest({job,sourceCv})
    if(requestError) return NextResponse.json({error:requestError},{status:400})

    const structure=detectCvStructure(sourceCv.cvText)
    const blocks=await writeCvAdaptation({job,sourceCv,structure})
    return NextResponse.json({stage:'adaptation_written',blocks})
  }catch{
    return NextResponse.json({error:'CV adaptation failed. Please try again.'},{status:502})
  }
}
