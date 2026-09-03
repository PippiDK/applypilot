export const APPLIED_JOBS_STORAGE_KEY='applypilot-applied-jobs-v1'

const text=value=>String(value??'').trim()

function normalizeEntry(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return null
  const jobId=text(value.jobId||value.sourceJobId)
  if(!jobId) return null
  const relevanceScore=Number(value.relevanceScore)
  return {
    jobId,
    title:text(value.title)||'Untitled role',
    company:text(value.company)||'Unknown company',
    location:text(value.location),
    source:text(value.source)||'LinkedIn',
    originalUrl:text(value.originalUrl),
    publishedAt:text(value.publishedAt)||null,
    appliedAt:text(value.appliedAt)||null,
    relevanceScore:Number.isFinite(relevanceScore)?relevanceScore:null,
  }
}

export function normalizeAppliedJobs(value){
  const result=[]
  const seen=new Set()
  for(const raw of Array.isArray(value)?value:[]){
    const entry=normalizeEntry(raw)
    if(!entry||seen.has(entry.jobId)) continue
    seen.add(entry.jobId)
    result.push(entry)
  }
  return result.sort((a,b)=>new Date(b.appliedAt||0)-new Date(a.appliedAt||0))
}

export function readAppliedJobs(storage){
  try{return normalizeAppliedJobs(JSON.parse(storage?.getItem?.(APPLIED_JOBS_STORAGE_KEY)||'[]'))}
  catch{return []}
}

export function archiveAppliedJob({storage,archive=[],job,evaluation,appliedAt}={}){
  const jobId=text(job?.sourceJobId||job?.jobId)
  if(!jobId) return normalizeAppliedJobs(archive)
  const previous=normalizeAppliedJobs(archive)
  const existing=previous.find(item=>item.jobId===jobId)
  const entry=normalizeEntry({
    jobId,
    title:job?.title,
    company:job?.company,
    location:job?.location,
    source:job?.source||existing?.source||'LinkedIn',
    originalUrl:job?.originalUrl||existing?.originalUrl,
    publishedAt:job?.publishedAt||existing?.publishedAt,
    appliedAt:existing?.appliedAt||appliedAt||new Date().toISOString(),
    relevanceScore:evaluation?.score??existing?.relevanceScore,
  })
  const next=normalizeAppliedJobs([entry,...previous.filter(item=>item.jobId!==jobId)])
  storage?.setItem?.(APPLIED_JOBS_STORAGE_KEY,JSON.stringify(next))
  return next
}

export function syncAppliedArchive({storage,archive=[],items=[],statuses={}}={}){
  let next=normalizeAppliedJobs(archive)
  for(const item of Array.isArray(items)?items:[]){
    const jobId=text(item?.job?.sourceJobId)
    if(jobId&&statuses?.[jobId]==='applied'){
      next=archiveAppliedJob({storage,archive:next,job:item.job,evaluation:item.evaluation})
    }
  }
  return next
}
