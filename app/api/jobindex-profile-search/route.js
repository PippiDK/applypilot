import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { buildDiscoverySearchPlan } from '../../lib/search-query-expansion-ai.js'
import { searchJobindexSource } from '../../lib/jobindex-source-adapter.js'
import { evaluateProfileJob } from '../../lib/job-profile-evaluator.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

function isLimited(job={}){
  return (Array.isArray(job?.sourceRecords)?job.sourceRecords:[]).some(record=>record?.limitedData===true)||!String(job?.fullJd||job?.description||'').trim()
}

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

    const discoverySearchPlan=await buildDiscoverySearchPlan({unionSearchPlan})
    const source=await searchJobindexSource({
      freshnessDays,
      unionSearchPlan:discoverySearchPlan,
      exclusionRules,
      filters:{},
      fetcher:globalThis.fetch,
    })

    const jobs=[]
    const audit=[]
    let evaluated=0
    let unverified=0

    for(const job of Array.isArray(source?.jobs)?source.jobs:[]){
      const jobId=job?.jobId||job?.sourceJobId||''
      if(isLimited(job)){
        unverified++
        audit.push({jobId,title:job?.title||'',company:job?.company||'',stage:'FULL_JD_UNVERIFIED',decision:'UNVERIFIED',score:null,reason:'Full Job Description could not be verified'})
        continue
      }
      evaluated++
      const result=evaluateProfileJob({
        job,
        foundBy:Array.isArray(job?.foundBy)&&job.foundBy.length?job.foundBy:discoverySearchPlan.directions,
        exclusionRules,
        freshnessDays,
      })
      audit.push({jobId,title:job?.title||'',company:job?.company||'',stage:result.stage,decision:result.decision,score:result.evaluation?.score??null,reason:result.reason})
      if(result.pass) jobs.push({job,evaluation:result.evaluation})
    }

    jobs.sort((a,b)=>b.evaluation.score-a.evaluation.score||(new Date(b.job.publishedAt||0)-new Date(a.job.publishedAt||0)))
    const discovered=Number(source?.stats?.discovered)||0
    const fullJdVerified=Number(source?.stats?.fullJdVerified)||0
    const inaccessible=Number(source?.stats?.searchFailures||0)+Number(source?.stats?.detailFailures||0)+Number(source?.stats?.externalDetailFailures||0)+unverified
    const status=inaccessible?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS'

    return NextResponse.json({
      jobs,
      audit,
      stats:{...source?.stats,discovered,fullJdVerified,evaluated,returned:jobs.length},
      coverage:{source:'Jobindex',freshnessDays,status,detail:source?.error||null},
      fetchedAt:new Date().toISOString(),
    })
  }catch(error){
    console.error('jobindex-profile-search error',error)
    return NextResponse.json({error:String(error?.message||'Jobindex search failed')},{status:502})
  }
}
