import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { searchLinkedInShadow } from '../../lib/linkedin-shadow-discovery.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const unionSearchPlan=body?.unionSearchPlan&&typeof body.unionSearchPlan==='object'?body.unionSearchPlan:{directions:[]}
    const result=await searchLinkedInShadow({freshnessDays,unionSearchPlan,fetcher:createLinkedInStableFetcher()})
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('linkedin-shadow-search error',error)
    return NextResponse.json({error:String(error?.message||'LinkedIn shadow search failed')},{status:502})
  }
}
