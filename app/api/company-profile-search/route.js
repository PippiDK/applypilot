import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { searchTeamtailorCompanies } from '../../lib/teamtailor-company-source.js'
import { evaluateProfileJob } from '../../lib/job-profile-evaluator.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const companies=Array.isArray(body?.companies)?body.companies:[]
    const exclusionRules=Array.isArray(body?.exclusionRules)?body.exclusionRules:[]
    const foundBy=Array.isArray(body?.unionSearchPlan?.directions)?body.unionSearchPlan.directions:[]
    if(!companies.length) return NextResponse.json({jobs:[],audit:[],stats:{discovered:0,fullJdVerified:0,evaluated:0,returned:0},coverage:{source:'Company sites',freshnessDays,status:'NO RELEVANT RESULTS'},fetchedAt:new Date().toISOString()})

    const source=await searchTeamtailorCompanies({companies,freshnessDays,fetcher:globalThis.fetch})
    const jobs=[]; const audit=[]; let evaluated=0
    for(const job of Array.isArray(source.jobs)?source.jobs:[]){
      evaluated++
      const result=evaluateProfileJob({job,foundBy,exclusionRules,freshnessDays})
      audit.push({jobId:job?.jobId||job?.sourceJobId||'',title:job?.title||'',company:job?.company||'',stage:result.stage,decision:result.decision,score:result.evaluation?.score??null,reason:result.reason})
      if(result.pass) jobs.push({job,evaluation:result.evaluation})
    }
    jobs.sort((a,b)=>b.evaluation.score-a.evaluation.score||(new Date(b.job.publishedAt||0)-new Date(a.job.publishedAt||0)))
    return NextResponse.json({
      jobs,audit,
      stats:{...source.stats,evaluated,returned:jobs.length},
      coverage:{source:'Company sites',freshnessDays,status:source.status==='partial'?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS',detail:source.error||null},
      fetchedAt:new Date().toISOString(),
    })
  }catch(error){
    console.error('company-profile-search error',error)
    return NextResponse.json({error:String(error?.message||'Company site search failed')},{status:502})
  }
}
