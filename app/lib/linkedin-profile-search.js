import {searchLinkedInProfileDiscovery} from './linkedin-profile-discovery.js'
import {createAuditRecord,updateAuditRecord,auditList} from './linkedin-search-audit.js'
import {runProfileJdBatch} from './linkedin-profile-jd-batch.js'

const WINDOWS=new Set([1,3,7,14])

export async function searchLinkedInProfile({
  freshnessDays=7,unionSearchPlan={},exclusionRules=[],fetcher,now=new Date(),modelCall
}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  if(typeof fetcher!=='function') throw new Error('Profile-driven LinkedIn fetcher is required.')
  if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0) throw new Error('Search Profile requires at least one role direction.')

  const discovery=await searchLinkedInProfileDiscovery({freshnessDays:days,unionSearchPlan,fetcher})
  const auditMap=new Map(discovery.candidates.map(candidate=>[String(candidate.jobId),createAuditRecord(candidate)]))
  let remaining=discovery.candidates
  const processed=[]
  let fullJdVerified=0
  let evaluatedCandidates=0
  let accessLimited=Number(discovery.stats?.searchFailures||0)>0

  while(remaining.length){
    const batch=await runProfileJdBatch({
      candidates:remaining,
      fetcher,
      freshnessDays:days,
      exclusionRules,
      now,
      maxCandidates:16,
      safeBudgetMs:Number.MAX_SAFE_INTEGER,
      modelCall
    })
    processed.push(...batch.processed)
    fullJdVerified+=Number(batch.stats?.fullJdVerified||0)
    evaluatedCandidates+=Number(batch.stats?.evaluatedCandidates||0)
    accessLimited=accessLimited||batch.accessLimited
    if(batch.processed.length===0) break
    remaining=batch.remaining
  }

  for(const row of processed){
    updateAuditRecord(auditMap,row.candidate.jobId,{
      title:row.job?.title||row.candidate.title||'',
      company:row.job?.company||row.candidate.company||'',
      stage:row.audit?.stage||'FULL_JD_UNVERIFIED',
      decision:row.audit?.decision||'UNVERIFIED',
      reason:row.audit?.reason||row.error||null,
      ...(row.audit?.score==null?{}:{score:row.audit.score})
    })
  }

  const jobs=processed
    .filter(row=>row.detailStatus==='PROCESSED'&&row.job&&row.evaluation&&row.audit?.decision==='KEEP')
    .map(row=>({job:row.job,evaluation:row.evaluation}))
    .sort((a,b)=>b.evaluation.score-a.evaluation.score||(new Date(b.job.publishedAt||0)-new Date(a.job.publishedAt||0)))

  const detailRequests=processed.length
  const detailFailures=processed.filter(row=>row.audit?.stage==='DETAIL_FETCH_FAILED').length
  const incompleteDetails=processed.filter(row=>row.audit?.stage==='FULL_JD_UNVERIFIED').length
  const unverified=processed.filter(row=>row.detailStatus==='UNVERIFIED').length
  const inaccessible=Number(discovery.stats?.searchFailures||0)+unverified
  const status=accessLimited||inaccessible?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS'
  const firstError=processed.find(row=>row.detailStatus==='UNVERIFIED')?.error||null
  const detail=status==='ACCESS LIMITED'?(discovery.coverage?.detail||firstError||`${inaccessible} LinkedIn item(s) could not be fully verified`):null

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
