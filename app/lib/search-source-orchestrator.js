import { dedupeJobs } from './cross-source-dedupe.js'
import { normalizeJob } from './normalized-job.js'
import { evaluateProfileJob } from './job-profile-evaluator.js'

function selected(value=[]){return [...new Set((Array.isArray(value)?value:[]).map(item=>String(item||'').toLowerCase()).filter(item=>item==='linkedin'||item==='jobindex'))]}
function failedStatus(source,error){return {source,status:'failed',jobs:[],stats:null,audit:[],error:String(error?.message||error||`${source} search failed`)} }
function isLimited(job){return (job?.sourceRecords||[]).some(record=>record?.limitedData===true)||(!job?.title&&!job?.fullJd&&!job?.description)}

async function runSource(source,input,dependencies){
  const fn=dependencies?.[source]
  if(typeof fn!=='function') return failedStatus(source,`${source} adapter unavailable`)
  try{
    const result=await fn(input)
    return {
      source,
      status:['success','partial','failed'].includes(result?.status)?result.status:'success',
      jobs:Array.isArray(result?.jobs)?result.jobs:[],
      stats:result?.stats??null,
      coverage:result?.coverage??null,
      audit:Array.isArray(result?.audit)?result.audit:[],
      error:String(result?.error||''),
    }
  }catch(error){return failedStatus(source,error)}
}

export async function runMultiSourceSearch(input={},dependencies={}){
  const enabled=selected(input?.enabledSources)
  if(!enabled.length) throw new Error('Select at least one search source.')

  const settled=await Promise.all(enabled.map(source=>runSource(source,input,dependencies)))
  const sourceStatuses=Object.fromEntries(settled.map(result=>[result.source,{status:result.status,error:result.error,stats:result.stats,coverage:result.coverage??null}]))
  const acquired=settled.filter(result=>result.status!=='failed').flatMap(result=>result.jobs).map(normalizeJob)
  const merged=dedupeJobs(acquired)
  const jobs=[]
  const evaluationAudit=[]
  const now=dependencies?.now instanceof Date?dependencies.now:new Date()

  for(const job of merged){
    if(isLimited(job)){
      jobs.push({job,evaluation:null,limitedData:true})
      evaluationAudit.push({jobId:job.jobId||job.sourceJobId,stage:'LIMITED_DATA',decision:'UNVERIFIED',reason:'Full Job Description could not be retrieved'})
      continue
    }

    if((!Array.isArray(job.foundBy)||job.foundBy.length===0)&&job.legacyEvaluation){
      jobs.push({job,evaluation:job.legacyEvaluation,limitedData:false})
      evaluationAudit.push({jobId:job.jobId||job.sourceJobId,stage:'LEGACY_EVALUATED',decision:'KEEP',reason:'Preserved existing LinkedIn legacy evaluation',score:job.legacyEvaluation?.score??0})
      continue
    }

    const result=evaluateProfileJob({
      job,
      foundBy:Array.isArray(job.foundBy)?job.foundBy:[],
      exclusionRules:Array.isArray(input?.exclusionRules)?input.exclusionRules:[],
      freshnessDays:input?.freshnessDays,
      now,
    })
    evaluationAudit.push({jobId:job.jobId||job.sourceJobId,stage:result.stage,decision:result.decision,reason:result.reason,score:result.evaluation?.score??0})
    if(result.pass) jobs.push({job,evaluation:result.evaluation,limitedData:false})
  }

  jobs.sort((a,b)=>(b.evaluation?.score??-1)-(a.evaluation?.score??-1)||(new Date(b.job?.publishedAt||0)-new Date(a.job?.publishedAt||0)))
  const sourceAudit=settled.flatMap(result=>result.audit||[])
  const allFailed=enabled.every(source=>sourceStatuses[source]?.status==='failed')
  return {
    jobs,
    sourceStatuses,
    stats:{sources:Object.fromEntries(settled.map(result=>[result.source,result.stats])),acquired:acquired.length,deduped:merged.length,returned:jobs.length},
    coverage:settled.map(result=>result.coverage).filter(Boolean),
    audit:[...sourceAudit,...evaluationAudit],
    allFailed,
  }
}
