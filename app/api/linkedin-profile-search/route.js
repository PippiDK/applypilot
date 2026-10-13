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
    const freshnessDays=[1,3,5,7,10,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const unionSearchPlan=body?.unionSearchPlan&&typeof body.unionSearchPlan==='object'?body.unionSearchPlan:{directions:[]}
    const exclusionRules=Array.isArray(body?.exclusionRules)?body.exclusionRules:[]
    const previousCandidates=Array.isArray(body?.previousCandidates)?body.previousCandidates.slice(0,500):[]
    const previousVerifiedJobs=Array.isArray(body?.previousVerifiedJobs)?body.previousVerifiedJobs.slice(0,500):[]
    const continuation=body?.continuation===true
    const detailBatchStart=Math.max(0,Math.floor(Number(body?.detailBatchStart)||0))
    const requestedBatchSize=Math.floor(Number(body?.detailBatchSize)||10)
    const detailBatchSize=Math.max(1,Math.min(40,requestedBatchSize))
    if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0){
      return NextResponse.json({error:'Search Profile is not configured.'},{status:400})
    }
    const discoverySearchPlan=continuation?unionSearchPlan:await buildDiscoverySearchPlan({unionSearchPlan})
    const detail429Urls=new Set()
    let detail429Attempts=0
    let detail429Recovered=0
    const discoveryFetcher=continuation?null:createLinkedInStableFetcher({totalBudgetMs:85000})
    const detailFetcher=createLinkedInStableFetcher({
      minIntervalMs:1800,
      maxAttempts:2,
      baseBackoffMs:6000,
      maxBackoffMs:6000,
      totalBudgetMs:75000,
      onEvent:event=>{
        if(event?.type==='response_error'&&Number(event?.status)===429){
          detail429Attempts++
          detail429Urls.add(String(event?.url||''))
        }
        if(event?.type==='success'&&detail429Urls.has(String(event?.url||''))){
          detail429Recovered++
          detail429Urls.delete(String(event?.url||''))
        }
      },
    })
    const result=await searchLinkedInProfile({freshnessDays,unionSearchPlan:discoverySearchPlan,exclusionRules,previousCandidates,previousVerifiedJobs,discoveryFetcher,detailFetcher,continuation,detailBatchStart,detailBatchSize})
    const now=new Date()
    const freshnessSelection=freshnessSelectionFromDays(freshnessDays)
    const jobs=filterItemsByFreshnessSelection(result.jobs,freshnessSelection,now)
    const accessLimited=result?.coverage?.status==='ACCESS LIMITED'
    return NextResponse.json({
      ...result,
      jobs,
      continuationSearchPlan:discoverySearchPlan,
      stats:{...result?.stats,detail429Attempts,detail429Recovered,returned:jobs.length},
      coverage:{...result?.coverage,freshnessDays,freshnessSelection,status:accessLimited?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS'},
      fetchedAt:now.toISOString(),
    })
  }catch(error){
    console.error('linkedin-profile-search error',error)
    return NextResponse.json({error:String(error?.message||'Profile-driven LinkedIn search failed')},{status:502})
  }
}
