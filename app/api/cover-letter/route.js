import {NextResponse} from 'next/server'
import {writeCoverLetter} from '../../lib/cover-letter.js'
import {requireUser} from '../../lib/auth/require-user.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()
const raw=value=>String(value??'')

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

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const job=requestJob(body?.job)
    const sourceCv=requestSourceCv(body?.sourceCv)
    if(!job.title||job.description.length<80) return NextResponse.json({error:'A usable vacancy is required for the cover letter.'},{status:400})
    if(!sourceCv.cvId||!sourceCv.sourceVersion||sourceCv.cvText.trim().length<100) return NextResponse.json({error:'A complete selected CV is required for the cover letter.'},{status:400})

    const finalCvBlocks=Array.isArray(body?.finalCvBlocks)?body.finalCvBlocks
      .map(item=>({blockId:text(item?.blockId),text:text(item?.text)}))
      .filter(item=>item.blockId&&item.text)
      .slice(0,3):[]

    const result=await writeCoverLetter({job,sourceCv,finalCvBlocks})
    if(!result.letter) return NextResponse.json({error:'Cover letter generation returned no usable text.'},{status:502})
    return NextResponse.json(result)
  }catch(error){
    console.error('cover_letter_failed',error?.code||error?.message||'unknown')
    return NextResponse.json({error:'Cover letter generation failed safely. Please try again.'},{status:502})
  }
}
