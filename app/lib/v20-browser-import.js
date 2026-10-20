// Apply Pilot v20: browser-export ingestion. No calls to legacy discovery or persistence.
const clean=value=>String(value??'').trim()
const linkedInUrl=id=>`https://www.linkedin.com/jobs/view/${id}/`
export const V20_IMPORT_STORAGE_KEY='auvraen-v20-browser-import-v1'
export const V20_STATUS_STORAGE_KEY='auvraen-v20-job-status-v1'
export const V20_MAX_RECORDS=1000
const missingMarker=/\[remainder of source sentence missing\]/i
function validJobId(value){return /^[0-9]{6,15}$/.test(clean(value))}
export function normalizeBrowserRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid job record')
  const id=clean(value.sourceJobId||value.jobId)
  const title=clean(value.title)
  const company=clean(value.company)
  const description=clean(value.fullJd)
  if(!validJobId(id)||!title||!company) throw new Error('Job ID, title and company are required')
  const rawUrl=clean(value.url)
  let url
  try{url=new URL(rawUrl)}catch{throw new Error('Invalid LinkedIn job URL')}
  if(url.protocol!=='https:'||!['www.linkedin.com','linkedin.com'].includes(url.hostname)||!new RegExp(`^/jobs/view/${id}/?$`).test(url.pathname)) throw new Error('Job URL does not match LinkedIn Job ID')
  const jdComplete=description.length>=100&&!missingMarker.test(description)&&value.jdStatus==='complete'
  return {
    source:'linkedin',sourceJobId:id,jobId:`linkedin:${id}`,
    title,company,location:clean(value.location),
    description,fullJd:description,detailUrl:linkedInUrl(id),originalUrl:linkedInUrl(id),
    publishedText:clean(value.publishedText),
    // Preserve an explicitly supplied ISO posting timestamp; never infer one from import time.
    publishedAt:typeof value.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value.publishedAt)&&Number.isFinite(Date.parse(value.publishedAt))?new Date(value.publishedAt).toISOString():null,
    jdStatus:jdComplete?'complete':'review',
    needsJdReview:!jdComplete,
  }
}
export function parseBrowserExport(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||input.schemaVersion!==1||input.source!=='linkedin-browser'||!Array.isArray(input.records)) throw new Error('Not a supported AUVRAEN Collector JSON export')
  if(input.records.length>V20_MAX_RECORDS) throw new Error('Export exceeds 1,000 vacancies')
  const jobs=[],errors=[],seen=new Set()
  for(let i=0;i<input.records.length;i++){
    try{
      const job=normalizeBrowserRecord(input.records[i])
      if(seen.has(job.sourceJobId)) continue
      seen.add(job.sourceJobId)
      jobs.push(job)
    }catch(error){errors.push({row:i+1,reason:error.message})}
  }
  return {jobs,errors,inputCount:input.records.length,pagesCollected:Number(input.pagesCollected)||null}
}
export function mergeBrowserJobs(existing=[],incoming=[]){
  const byId=new Map()
  for(const job of [...existing,...incoming]){
    if(!job?.sourceJobId) continue
    const key=String(job.sourceJobId)
    const prior=byId.get(key)
    if(!prior){byId.set(key,job);continue}
    // Never replace a longer verified JD with a shorter or incomplete one.
    const currentComplete=job.jdStatus==='complete'&&!job.needsJdReview
    const priorComplete=prior.jdStatus==='complete'&&!prior.needsJdReview
    if((currentComplete&&!priorComplete)||(currentComplete===priorComplete&&String(job.fullJd||'').length>String(prior.fullJd||'').length)) byId.set(key,job)
  }
  if(byId.size>V20_MAX_RECORDS) throw new Error('v20 browser collection exceeds 1,000 vacancies')
  return [...byId.values()]
}
