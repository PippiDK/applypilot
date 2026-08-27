import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { searchLinkedInProfile } from '../../lib/linkedin-profile-search.js'

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
    const exclusionRules=Array.isArray(body?.exclusionRules)?body.exclusionRules:[]
    if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0){
      return NextResponse.json({error:'Search Profile is not configured.'},{status:400})
    }
    const result=await searchLinkedInProfile({freshnessDays,unionSearchPlan,exclusionRules,fetcher:createLinkedInStableFetcher()})
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('linkedin-profile-search error',error)
    return NextResponse.json({error:String(error?.message||'Profile-driven LinkedIn search failed')},{status:502})
  }
}
