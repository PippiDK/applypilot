import {
  DISCOVERY_QUERIES,
  parseSearchHtml,
  parseDetailHtml,
  discoveryCandidate,
  evaluateJob,
} from './linkedin-search.js'
import { createLinkedInStableFetcher } from './linkedin-stable-fetcher.js'
import { buildDiscoveryPlan } from './linkedin-discovery-plan.js'

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
  const discoveryPlan=buildDiscoveryPlan(DISCOVERY_QUERIES,freshnessDays)
  const diagnostics={searchRequests:0,searchFailures:0,searchRows:0,detailRequests:0,detailFailures:0,incompleteDetails:0}

  const searchResults=await mapLimit(discoveryPlan,5,async ({query,seconds,start})=>{
    diagnostics.searchRequests++
    const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:String(start)})
    const html=await stableFetcher(`${LINKEDIN_SEARCH}?${qs}`)
    return parseSearchHtml(html)
  })

  const errors=[]
  const rows=[]
  for(const result of searchResults){
    if(result.status==='fulfilled'){
      rows.push(...result.value)
      diagnostics.searchRows+=result.value.length
    }else{
      diagnostics.searchFailures++
      errors.push(String(result.reason?.message||result.reason))
    }
  }

  if(diagnostics.searchFailures===diagnostics.searchRequests){
    throw new Error(`LinkedIn public search unavailable: ${errors[0]||'all search requests failed'}`)
  }

  const byId=new Map()
  for(const row of rows) if(!byId.has(row.jobId)) byId.set(row.jobId,row)
  const unique=[...byId.values()].sort((a,b)=>(safeDate(b.publishedAt)?.getTime()||0)-(safeDate(a.publishedAt)?.getTime()||0))

  const details=await mapLimit(unique,8,async row=>{
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

  if(unique.length>0 && jobs.length===0 && diagnostics.detailFailures+diagnostics.incompleteDetails===unique.length){
    throw new Error(`LinkedIn job details unavailable: ${errors.at(-1)||'no full JD could be read'}`)
  }

  const evaluated=[]
  for(const job of jobs){
    const published=safeDate(job.publishedAt)
    if(published && (now.getTime()-published.getTime())>Number(freshnessDays||7)*86400000+21600000) continue
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
