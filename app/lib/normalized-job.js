const SOURCE_ORDER=['linkedin','jobindex']
const SOURCE_LABELS={linkedin:'LinkedIn',jobindex:'Jobindex'}

function clean(value){ return String(value??'').trim() }
function directionKey(direction={}){return [direction.tier,direction.role,direction.query].map(value=>clean(value).toLowerCase()).join('|')}

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

export function normalizeFoundBy(foundBy=[]){
  const output=[]
  const seen=new Set()
  for(const direction of Array.isArray(foundBy)?foundBy:[]){
    if(!direction||typeof direction!=='object') continue
    const role=clean(direction.role)
    if(!role) continue
    const normalized={...direction,role,tier:direction.tier==='primary'?'primary':'adjacent',query:clean(direction.query||direction.role)}
    const key=directionKey(normalized)
    if(seen.has(key)) continue
    seen.add(key)
    output.push(normalized)
  }
  return output
}

export function normalizeJob(job={}){
  const sourceRecords=(Array.isArray(job.sourceRecords)?job.sourceRecords:[]).map(normalizeSourceRecord).filter(record=>record.source)
  const firstRecord=sourceRecords[0]||{}
  const sourceJobId=clean(job.sourceJobId||firstRecord.sourceJobId)
  const source=clean(firstRecord.source||job.source).toLowerCase()
  const jobId=clean(job.jobId)||(source&&sourceJobId?`${source}:${sourceJobId}`:sourceJobId||'')
  const fullJd=bestFullJd(sourceRecords,job.fullJd||job.description)
  const publishedAt=job.publishedAt??job.postedDate??null
  return {
    ...job,
    jobId,
    sourceJobId,
    title:clean(job.title),
    company:clean(job.company),
    location:clean(job.location),
    postedDate:job.postedDate??publishedAt,
    publishedAt,
    detailUrl:clean(job.detailUrl||firstRecord.detailUrl),
    applicationUrl:clean(job.applicationUrl||firstRecord.applicationUrl),
    fullJd,
    description:clean(job.description||fullJd),
    foundBy:normalizeFoundBy(job.foundBy),
    sourceRecords,
  }
}

export function sourceLabel(job={}){
  const found=new Set((Array.isArray(job.sourceRecords)?job.sourceRecords:[]).map(record=>clean(record?.source).toLowerCase()).filter(Boolean))
  return SOURCE_ORDER.filter(source=>found.has(source)).map(source=>SOURCE_LABELS[source]).join(' · ')
}
