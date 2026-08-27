import {parseDetailHtml} from './linkedin-search.js'
import {searchLinkedInProfileDiscovery} from './linkedin-profile-discovery.js'
import {createAuditRecord,updateAuditRecord,auditList} from './linkedin-search-audit.js'
import {evaluateProfileJob} from './linkedin-profile-evaluator.js'

const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'
const WINDOWS=new Set([1,3,7,14])

async function mapLimit(items,limit,fn){
  const results=new Array(items.length)
  let next=0
  async function worker(){
    while(true){
      const index=next++
      if(index>=items.length) return
      try{results[index]={status:'fulfilled',value:await fn(items[index],index)}}
      catch(reason){results[index]={status:'rejected',reason,item:items[index]}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
}

export {evaluateProfileJob} from './linkedin-profile-evaluator.js'

export async function searchLinkedInProfile({freshnessDays=7,unionSearchPlan={},exclusionRules=[],fetcher,now=new Date()}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  if(typeof fetcher!=='function') throw new Error('Profile-driven LinkedIn fetcher is required.')
  if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0) throw new Error('Search Profile requires at least one role direction.')

  const discovery=await searchLinkedInProfileDiscovery({freshnessDays:days,unionSearchPlan,fetcher})
  const auditMap=new Map(discovery.candidates.map(candidate=>[String(candidate.jobId),createAuditRecord(candidate)]))
  let detailRequests=0
  let detailFailures=0
  let incompleteDetails=0
  let fullJdVerified=0
  let evaluatedCandidates=0

  const settled=await mapLimit(discovery.candidates,4,async candidate=>{
    detailRequests++
    const html=await fetcher(`${LINKEDIN_JOB_DETAIL}${candidate.jobId}`)
    const job=parseDetailHtml(candidate,html,now)
    return {candidate,job}
  })

  const jobs=[]
  const detailErrors=[]
  for(const item of settled){
    if(item.status==='rejected'){
      detailFailures++
      const candidate=item.item||{}
      detailErrors.push(String(item.reason?.message||item.reason||'LinkedIn detail request failed'))
      updateAuditRecord(auditMap,candidate.jobId,{stage:'DETAIL_FETCH_FAILED',decision:'UNVERIFIED',reason:'Full Job Description could not be retrieved'})
      continue
    }

    const {candidate,job}=item.value
    if(!job){
      incompleteDetails++
      const outcome=evaluateProfileJob({candidate,job,freshnessDays:days,exclusionRules,now})
      updateAuditRecord(auditMap,candidate.jobId,{stage:outcome.stage,decision:outcome.decision,reason:outcome.reason})
      continue
    }

    fullJdVerified++
    updateAuditRecord(auditMap,candidate.jobId,{title:job.title,company:job.company,stage:'FULL_JD_VERIFIED',decision:'PENDING'})
    const outcome=evaluateProfileJob({candidate,job,freshnessDays:days,exclusionRules,now})
    if(outcome.evaluated) evaluatedCandidates++
    updateAuditRecord(auditMap,candidate.jobId,{stage:outcome.stage,decision:outcome.decision,reason:outcome.reason,...(outcome.score==null?{}:{score:outcome.score})})
    if(outcome.keep) jobs.push({job,evaluation:outcome.evaluation})
  }

  jobs.sort((a,b)=>b.evaluation.score-a.evaluation.score||(new Date(b.job.publishedAt||0)-new Date(a.job.publishedAt||0)))
  const inaccessible=Number(discovery.stats?.searchFailures||0)+detailFailures+incompleteDetails
  const status=inaccessible?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS'
  const detail=inaccessible?(discovery.coverage?.detail||detailErrors[0]||`${inaccessible} LinkedIn item(s) could not be fully verified`):null

  return {
    jobs,
    audit:auditList(auditMap),
    stats:{
      ...discovery.stats,
      detailRequests,
      detailFailures,
      incompleteDetails,
      fullJdVerified,
      evaluatedCandidates,
      evaluated:jobs.length,
      returned:jobs.length,
    },
    coverage:{source:'LinkedIn Jobs',freshnessDays:days,status,detail},
  }
}
