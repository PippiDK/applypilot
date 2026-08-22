import {NextResponse} from 'next/server'
import {analyzeExpertiseMatch} from '../../lib/expertise-service.js'

export const dynamic='force-dynamic'
const text=value=>String(value??'').trim()

export async function POST(request){
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
  }catch{
    return NextResponse.json({error:'Expertise Match analysis failed safely. Please try again.'},{status:502})
  }
}
