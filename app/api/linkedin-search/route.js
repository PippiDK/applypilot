import { NextResponse } from 'next/server'
import { searchLinkedInStable as searchLinkedIn } from '../../lib/linkedin-stable-search.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { requireUser } from '../../lib/auth/require-user.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const cvText=String(body?.cvText??'').trim()
    if(cvText.length<100) return NextResponse.json({error:'Please Upload Your CV'},{status:400})
    const fetcher=createLinkedInStableFetcher()
    const result=await searchLinkedIn({freshnessDays,resume:cvText,fetcher})
    console.log('linkedin-search',JSON.stringify({coverage:result.coverage.status,stats:result.stats,diagnostics:result.diagnostics}))
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('linkedin-search error',error)
    return NextResponse.json({error:String(error?.message||'LinkedIn public search failed')},{status:502})
  }
}
