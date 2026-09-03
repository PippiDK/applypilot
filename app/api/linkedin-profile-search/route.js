import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { searchLinkedInProfile } from '../../lib/linkedin-profile-search.js'
import { buildDiscoverySearchPlan } from '../../lib/search-query-expansion-ai.js'
import { freshnessSelectionFromDays,filterItemsByFreshnessSelection } from '../../lib/freshness-selection.js'

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
    const previousCandidates=Array.isArray(body?.previousCandidates)?body.previousCandidates.slice(0,500):[]
    const previousVerifiedJobs=Array.isArray(body?.previousVerifiedJobs)?body.previousVerifiedJobs.slice(0,500):[]
    if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0){
      return NextResponse.json({error:'Search Profile is not configured.'},{status:400})
    }
    const discoverySearchPlan=await buildDiscoverySearchPlan({unionSearchPlan})
    const result=await searchLinkedInProfile({freshnessDays,unionSearchPlan:discoverySearchPlan,exclusionRules,previousCandidates,previousVerifiedJobs,fetcher:createLinkedInStableFetcher()})
    const now=new Date()
    const freshnessSelection=freshnessSelectionFromDays(freshnessDays)
    const jobs=filterItemsByFreshnessSelection(result.jobs,freshnessSelection,now)
    const accessLimited=result?.coverage?.status==='ACCESS LIMITED'
    return NextResponse.json({
      ...result,
      jobs,
      stats:{...result?.stats,returned:jobs.length},
      coverage:{...result?.coverage,freshnessDays,freshnessSelection,status:accessLimited?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS'},
      fetchedAt:now.toISOString(),
    })
  }catch(error){
    console.error('linkedin-profile-search error',error)
    return NextResponse.json({error:String(error?.message||'Profile-driven LinkedIn search failed')},{status:502})
  }
}
