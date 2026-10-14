import {normalizeBrowserRecord} from './v20-browser-import.js'

// Only a data-shape adapter. It neither scores jobs nor touches Legacy search.
const str=value=>String(value??'').trim()
function workModelFromLocation(location){
  const match=str(location).match(/\((Hybrid|On-site|Onsite|Remote)\)\s*$/i)
  if(!match)return ''
  return match[1].toLowerCase()==='hybrid'?'hybrid':match[1].toLowerCase()==='remote'?'remote':'onsite'
}
function isDenmark(location){return /\b(denmark|danmark)\b/i.test(location)}
function timestampOrNull(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return null
  const date=new Date(value)
  return Number.isFinite(date.getTime())?date.toISOString():null
}
export function collectorRecordToApplyPilotJob(record={}){
  const clean=normalizeBrowserRecord(record)
  const original=record&&typeof record==='object'?record:{}
  const publishedAt=timestampOrNull(original.publishedAt)
  const remoteType=workModelFromLocation(clean.location)
  return {
    source:'linkedin',
    importSource:'linkedin-json',
    importLabel:'LinkedIn Import',
    sourceJobId:clean.sourceJobId,
    jobId:clean.jobId,
    title:clean.title,
    company:clean.company,
    location:clean.location,
    country:isDenmark(clean.location)?'Denmark':'',
    remoteType,
    publishedAt,
    postedDate:publishedAt,
    publishedText:clean.publishedText,
    fullJd:clean.fullJd,
    description:clean.description,
    originalUrl:clean.originalUrl,
    detailUrl:clean.detailUrl,
    applicationUrl:clean.originalUrl,
    jdStatus:clean.jdStatus,
    needsJdReview:clean.needsJdReview,
    sourceRecords:[{
      source:'linkedin',
      sourceJobId:clean.sourceJobId,
      detailUrl:clean.detailUrl,
      applicationUrl:clean.originalUrl,
      fullJd:clean.fullJd,
      limitedData:clean.needsJdReview,
      importSource:'linkedin-json'
    }],
    foundBy:[]
  }
}

export function collectorJobsToApplyPilotJobs(jobs=[]){
  if(!Array.isArray(jobs))throw new Error('Collector jobs must be an array')
  const seen=new Set()
  const result=[]
  for(const record of jobs){
    const job=collectorRecordToApplyPilotJob(record)
    if(seen.has(job.sourceJobId))continue
    seen.add(job.sourceJobId)
    result.push(job)
  }
  return result
}
