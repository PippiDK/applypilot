import {NextResponse} from 'next/server'
import {POST} from '../route.js'

export const dynamic='force-dynamic'

export async function GET(){
  if(process.env.VERCEL_ENV!=='preview'){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  const marker={
    jobId:'__step4_post_probe__',
    title:'Step 4 POST Probe',
    company:'ApplyPilot TEST',
    location:'Copenhagen',
    source:'TEST',
    originalUrl:'https://example.invalid/step4-post',
    publishedAt:'2026-09-18T00:00:00.000Z',
    appliedAt:'2026-09-18T00:40:00.000Z',
    relevanceScore:96,
  }

  const request=new Request('http://localhost/api/applied-jobs',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jobs:[marker]}),
  })
  const response=await POST(request)
  const body=await response.json()

  return NextResponse.json({
    ok:response.ok,
    status:response.status,
    stored:Array.isArray(body?.jobs)&&body.jobs.some(job=>job?.jobId===marker.jobId),
  },{status:response.ok?200:500})
}
