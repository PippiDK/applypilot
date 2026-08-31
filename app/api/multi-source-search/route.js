import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { normalizeSearchSources } from '../../lib/search-sources.js'
import { runMultiSourceSearch } from '../../lib/search-source-orchestrator.js'
import { searchLinkedInSource } from '../../lib/linkedin-source-adapter.js'
import { searchJobindexSource } from '../../lib/jobindex-source-adapter.js'
import { buildDiscoverySearchPlan } from '../../lib/search-query-expansion-ai.js'
import { acquireLinkedInProfileJobs } from '../../lib/linkedin-profile-acquisition.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { searchLinkedInStable } from '../../lib/linkedin-stable-search.js'

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
    const cvText=String(body?.cvText??'').trim()
    const enabledSources=normalizeSearchSources(body?.enabledSources,{defaultWhenMissing:false})
    const filters=body?.filters&&typeof body.filters==='object'?body.filters:{}

    if(!enabledSources.length){
      return NextResponse.json({error:'Select at least one search source.'},{status:400})
    }

    let discoverySearchPlanPromise=null
    const sharedDiscoverySearchPlan=({unionSearchPlan:requestedPlan}={})=>{
      if(!discoverySearchPlanPromise) discoverySearchPlanPromise=buildDiscoverySearchPlan({unionSearchPlan:requestedPlan})
      return discoverySearchPlanPromise
    }

    const sharedInput={freshnessDays,unionSearchPlan,exclusionRules,cvText,enabledSources,filters}
    const result=await runMultiSourceSearch(sharedInput,{
      linkedin:input=>searchLinkedInSource({
        ...input,
        dependencies:{
          buildDiscoverySearchPlan:sharedDiscoverySearchPlan,
          acquireLinkedInProfileJobs,
          createLinkedInStableFetcher,
          searchLinkedInStable,
        },
      }),
      jobindex:input=>searchJobindexSource({
        ...input,
        fetcher:globalThis.fetch,
        dependencies:{buildDiscoverySearchPlan:sharedDiscoverySearchPlan},
      }),
    })

    if(result.allFailed){
      return NextResponse.json({error:'Selected search sources are currently unavailable.',...result,fetchedAt:new Date().toISOString()},{status:502})
    }
    return NextResponse.json({...result,fetchedAt:new Date().toISOString()})
  }catch(error){
    console.error('multi-source-search error',error)
    return NextResponse.json({error:String(error?.message||'Multi-source search failed')},{status:502})
  }
}
