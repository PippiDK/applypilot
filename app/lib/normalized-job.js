const SOURCE_ORDER=['linkedin','jobindex']
const SOURCE_LABELS={linkedin:'LinkedIn',jobindex:'Jobindex'}

function clean(value){ return String(value??'').trim() }

export function normalizeSourceRecord(record={}){
  const source=clean(record.source).toLowerCase()
  return {
    ...record,
    source,
    sourceJobId:clean(record.sourceJobId),
    detailUrl:clean(record.detailUrl),
    applicationUrl:clean(record.applicationUrl),
    fullJd:clean(record.fullJd),
  }
}

export function bestFullJd(sourceRecords=[],fallback=''){
  const candidates=[clean(fallback),...(Array.isArray(sourceRecords)?sourceRecords:[]).map(record=>clean(record?.fullJd))].filter(Boolean)
  if(!candidates.length) return ''
  return candidates.reduce((best,current)=>current.length>best.length?current:best,'')
}

export function normalizeJob(job={}){
  const sourceRecords=(Array.isArray(job.sourceRecords)?job.sourceRecords:[]).map(normalizeSourceRecord).filter(record=>record.source)
  const firstRecord=sourceRecords[0]||{}
  const sourceJobId=clean(job.sourceJobId||firstRecord.sourceJobId)
  const source=clean(firstRecord.source||job.source).toLowerCase()
  const jobId=clean(job.jobId)||(source&&sourceJobId?`${source}:${sourceJobId}`:sourceJobId||'')
  return {
    ...job,
    jobId,
    sourceJobId,
    title:clean(job.title),
    company:clean(job.company),
    location:clean(job.location),
    postedDate:job.postedDate??null,
    detailUrl:clean(job.detailUrl||firstRecord.detailUrl),
    applicationUrl:clean(job.applicationUrl||firstRecord.applicationUrl),
    fullJd:bestFullJd(sourceRecords,job.fullJd),
    sourceRecords,
  }
}

export function sourceLabel(job={}){
  const found=new Set((Array.isArray(job.sourceRecords)?job.sourceRecords:[]).map(record=>clean(record?.source).toLowerCase()).filter(Boolean))
  return SOURCE_ORDER.filter(source=>found.has(source)).map(source=>SOURCE_LABELS[source]).join(' · ')
}
