import { NextResponse } from 'next/server'
import {
  DISCOVERY_QUERIES,
  parseSearchHtml,
  parseDetailHtml,
  discoveryCandidate,
  evaluateJob,
} from '../../lib/linkedin-search.js'
import { createLinkedInStableFetcher } from '../../lib/linkedin-stable-fetcher.js'
import { buildDiscoveryPasses } from '../../lib/linkedin-discovery-plan.js'
import { collectDiscoveryPasses } from '../../lib/linkedin-discovery-stabilizer.js'
import { classifyRoleTitle, roleGate } from '../../lib/linkedin-role-gate.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'

// Throwaway benchmark probe. No user CV data is stored here.
// This synthetic text contains every evidence family used by experienceScore.
// Therefore, if a job is still below 60 with this text, no real CV can rescue it
// purely through the CV-dependent experience/domain component.
const MAX_EVIDENCE_CV = `
Senior IT Project Delivery Manager.
End-to-end project delivery and delivery management across enterprise software platforms and business systems.
Systems integration and integrations. Digital transformation, technology transformation, IT transformation and data transformation.
Agile, Scrum, SAFe and hybrid delivery. Data platforms, data warehouse DWH, Power BI, BI and data engineering.
Financial IT, fintech, banking, trading, post-trade, payments, financial data, regulatory reporting, compliance and AML.
Governance, PMO, steering committee, risk management, risks, dependencies and RAID.
Senior stakeholder management, executive communication and executive reporting. Budget management, financial control and forecasting.
Release readiness, release, UAT, cutover, go-live, hypercare and handover. Distributed international teams and offshore delivery.
Implementation, migration, deployment and transition. Azure, cloud, Databricks and Snowflake.
`.trim()

function safeDate(value){
  const date=value?new Date(value):null
  return date && Number.isFinite(date.getTime())?date:null
}

async function mapLimit(items,limit,fn){
  const results=new Array(items.length)
  let next=0
  async function worker(){
    while(true){
      const index=next++
      if(index>=items.length) return
      try{ results[index]={status:'fulfilled',value:await fn(items[index],index)} }
      catch(reason){ results[index]={status:'rejected',reason} }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
}

export async function GET(request){
  if(process.env.VERCEL_ENV !== 'preview'){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  const {searchParams}=new URL(request.url)
  const key=String(searchParams.get('key')||'')
  const expected=String(process.env.VERCEL_GIT_COMMIT_SHA||'')
  if(!expected || key !== expected){
    return NextResponse.json({error:'Not found'},{status:404})
  }

  const queryIndex=Number(searchParams.get('queryIndex'))
  if(!Number.isInteger(queryIndex) || queryIndex<0 || queryIndex>=DISCOVERY_QUERIES.length){
    return NextResponse.json({
      benchmark:'cv-sensitivity-14d',
      queryCount:DISCOVERY_QUERIES.length,
      queries:DISCOVERY_QUERIES.map((query,index)=>({index,query})),
    })
  }

  try{
    const query=DISCOVERY_QUERIES[queryIndex]
    const fetcher=createLinkedInStableFetcher()
    const discovery=await collectDiscoveryPasses({
      queries:[query],
      passes:buildDiscoveryPasses(14),
      fetchPage:async ({seconds,start})=>{
        const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:String(start)})
        return parseSearchHtml(await fetcher(`${LINKEDIN_SEARCH}?${qs}`))
      },
    })

    const byId=new Map()
    for(const row of discovery.rows) if(!byId.has(row.jobId)) byId.set(row.jobId,row)
    const unique=[...byId.values()].sort((a,b)=>(safeDate(b.publishedAt)?.getTime()||0)-(safeDate(a.publishedAt)?.getTime()||0))

    const detailCandidates=unique.filter(row=>classifyRoleTitle(row.title).kind!=='exclude')
    const details=await mapLimit(detailCandidates,8,async row=>parseDetailHtml(row,await fetcher(`${LINKEDIN_JOB_DETAIL}${row.jobId}`),new Date()))

    const potential=[]
    let fullJdRead=0
    let preCvRejected=0
    let impossibleToRescue=0

    for(let i=0;i<details.length;i++){
      const detail=details[i]
      if(detail.status!=='fulfilled' || !detail.value) continue
      fullJdRead++
      const job=detail.value
      const roleDecision=roleGate(job)
      if(!roleDecision.pass || !discoveryCandidate(job)){
        preCvRejected++
        continue
      }
      const evaluation=evaluateJob(job,MAX_EVIDENCE_CV)
      if(evaluation.hardExclusion || evaluation.verdict==='Poor fit'){
        impossibleToRescue++
        continue
      }
      potential.push({job,syntheticEvaluation:evaluation})
    }

    return NextResponse.json({
      benchmark:'cv-sensitivity-14d',
      note:'Synthetic maximum-evidence CV; no user CV data used server-side.',
      fetchedAt:new Date().toISOString(),
      queryIndex,
      query,
      stats:{
        discovered:unique.length,
        detailCandidates:detailCandidates.length,
        fullJdRead,
        preCvRejected,
        impossibleToRescue,
        potential:potential.length,
      },
      discovery:{
        groups:discovery.groups,
        passStats:discovery.passStats,
        searchRequests:discovery.searchRequests,
        searchFailures:discovery.searchFailures,
      },
      jobs:potential,
    })
  }catch(error){
    console.error('cv-benchmark-dataset error',error)
    return NextResponse.json({error:String(error?.message||'Benchmark dataset failed')},{status:502})
  }
}
