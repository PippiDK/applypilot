import {
  DISCOVERY_QUERIES,
  parseSearchHtml,
  parseDetailHtml,
  discoveryCandidate,
  evaluateJob,
} from './linkedin-search.js'
import { createLinkedInStableFetcher } from './linkedin-stable-fetcher.js'
import { buildDiscoveryPasses } from './linkedin-discovery-plan.js'
import { collectDiscoveryPasses } from './linkedin-discovery-stabilizer.js'
import { classifyRoleTitle, roleGate } from './linkedin-role-gate.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'

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

export async function searchLinkedInStable({freshnessDays=7,resume,fetcher,now=new Date()}={}){
  const sourceCv=String(resume??'').trim()
  if(sourceCv.length<100) throw new Error('Source CV text is required for LinkedIn evaluation.')

  const stableFetcher=fetcher||createLinkedInStableFetcher()
  const discoveryPasses=buildDiscoveryPasses(freshnessDays)
  const discovery=await collectDiscoveryPasses({
    queries:DISCOVERY_QUERIES,
    passes:discoveryPasses,
    fetchPage:async ({query,seconds,start})=>{
      const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:String(start)})
      const html=await stableFetcher(`${LINKEDIN_SEARCH}?${qs}`)
      return parseSearchHtml(html)
    },
  })
  const diagnostics={
    searchRequests:discovery.searchRequests,
    searchFailures:discovery.searchFailures,
    searchRows:discovery.searchRows,
    discoveryPasses:discovery.passStats,
    discoveryGroups:discovery.groups,
    detailRequests:0,
    detailFailures:0,
    incompleteDetails:0,
    roleGateRejectedBeforeDetail:0,
    roleGateRejectedAfterDetail:0,
  }

  const errors=[...discovery.errors]
  const rows=discovery.rows

  if(diagnostics.searchFailures===diagnostics.searchRequests){
    throw new Error(`LinkedIn public search unavailable: ${errors[0]||'all search requests failed'}`)
  }

  const byId=new Map()
  for(const row of rows) if(!byId.has(row.jobId)) byId.set(row.jobId,row)
  const unique=[...byId.values()].sort((a,b)=>(safeDate(b.publishedAt)?.getTime()||0)-(safeDate(a.publishedAt)?.getTime()||0))

  const detailCandidates=unique.filter(row=>{
    const decision=classifyRoleTitle(row.title)
    if(decision.kind==='exclude'){
      diagnostics.roleGateRejectedBeforeDetail++
      return false
    }
    return true
  })

  const details=await mapLimit(detailCandidates,8,async row=>{
    diagnostics.detailRequests++
    const html=await stableFetcher(`${LINKEDIN_JOB_DETAIL}${row.jobId}`)
    return parseDetailHtml(row,html,now)
  })

  const jobs=[]
  for(const detail of details){
    if(detail.status==='fulfilled'){
      if(detail.value) jobs.push(detail.value)
      else diagnostics.incompleteDetails++
    }else{
      diagnostics.detailFailures++
      errors.push(String(detail.reason?.message||detail.reason))
    }
  }

  if(detailCandidates.length>0 && jobs.length===0 && diagnostics.detailFailures+diagnostics.incompleteDetails===detailCandidates.length){
    throw new Error(`LinkedIn job details unavailable: ${errors.at(-1)||'no full JD could be read'}`)
  }

  const evaluated=[]
  for(const job of jobs){
    const published=safeDate(job.publishedAt)
    if(published && (now.getTime()-published.getTime())>Number(freshnessDays||7)*86400000+21600000) continue
    const roleDecision=roleGate(job)
    if(!roleDecision.pass){
      diagnostics.roleGateRejectedAfterDetail++
      continue
    }
    if(!discoveryCandidate(job)) continue
    const evaluation=evaluateJob(job,sourceCv)
    if(evaluation.hardExclusion||evaluation.verdict==='Poor fit') continue
    evaluated.push({job,evaluation})
  }

  evaluated.sort((a,b)=>b.evaluation.score-a.evaluation.score || (safeDate(b.job.publishedAt)?.getTime()||0)-(safeDate(a.job.publishedAt)?.getTime()||0))
  const coverage=diagnostics.searchFailures||diagnostics.detailFailures?'ACCESS LIMITED':evaluated.length?'SEARCHED':'NO RELEVANT RESULTS'

  return {
    jobs:evaluated,
    coverage:{source:'LinkedIn Jobs',status:coverage,detail:errors[0]||null},
    stats:{discovered:unique.length,fullJdVerified:jobs.length,evaluated:evaluated.length,returned:evaluated.length},
    diagnostics,
  }
}
