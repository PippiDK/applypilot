const clean=value=>String(value??'').trim()

function normalizedSource(value=''){
  const source=clean(value).toLowerCase()
  if(!source) return ''
  if(source==='linkedin'||source==='linkedin jobs') return 'linkedin'
  if(source==='jobindex'||source==='jobindex.dk') return 'jobindex'
  if(source==='jobnet'||source==='jobnet.dk') return 'jobnet'
  return source
}

function firstSourceRecord(job={}){
  return Array.isArray(job?.sourceRecords)&&job.sourceRecords.length?job.sourceRecords[0]||{}:{}
}

function sourceOf(job={}){
  const record=firstSourceRecord(job)
  const direct=normalizedSource(record.source||job.source)
  if(direct) return direct
  const url=clean(job.originalUrl||job.detailUrl||record.detailUrl)
  if(/linkedin\.com/i.test(url)) return 'linkedin'
  if(/jobindex\.dk/i.test(url)) return 'jobindex'
  if(/jobnet\.dk/i.test(url)) return 'jobnet'
  return ''
}

function sourceJobIdOf(job={}){
  const record=firstSourceRecord(job)
  return clean(job.sourceJobId||record.sourceJobId)
}

function exactKeys(job={}){
  const output=[]
  const seen=new Set()
  const add=value=>{
    const key=clean(value)
    if(!key||seen.has(key)) return
    seen.add(key)
    output.push(key)
  }
  const source=sourceOf(job)
  const sourceJobId=sourceJobIdOf(job)
  add(job.jobId)
  if(source&&sourceJobId) add(`${source}:${sourceJobId}`)
  add(sourceJobId)
  return output
}

function canonicalUrl(value=''){
  const raw=clean(value)
  if(!raw) return ''
  try{
    const url=new URL(raw)
    const host=url.hostname.toLowerCase().replace(/^www\./,'')
    let path=url.pathname.replace(/\/+$/,'')||'/'
    return `${host}${path}`.toLowerCase()
  }catch{
    return raw.split('#')[0].split('?')[0].replace(/\/+$/,'').toLowerCase()
  }
}

function urlKeys(job={}){
  const record=firstSourceRecord(job)
  return [...new Set([
    job.originalUrl,
    job.detailUrl,
    record.detailUrl,
  ].map(canonicalUrl).filter(Boolean))]
}

function publicNightFlightEntry(entry={}){
  return {
    processed:entry?.processed===true,
    source:clean(entry?.source)||null,
    matchCacheKey:clean(entry?.matchCacheKey)||null,
    processedAt:entry?.processedAt||null,
    analysis:entry?.analysis??null,
  }
}

function buildLookup(index={}){
  const jobs=index&&typeof index==='object'&&index.jobs&&typeof index.jobs==='object'?index.jobs:{}
  const byExactKey=new Map()
  const byUrl=new Map()

  for(const [storedKey,entry] of Object.entries(jobs)){
    if(!entry||entry.processed!==true) continue
    const addExact=key=>{ if(key&&!byExactKey.has(key)) byExactKey.set(key,entry) }
    addExact(clean(storedKey))
    for(const key of exactKeys(entry.job||{})) addExact(key)
    for(const key of urlKeys(entry.job||{})) if(!byUrl.has(key)) byUrl.set(key,entry)
  }

  return {byExactKey,byUrl}
}

function findEntry(job,lookup){
  for(const key of exactKeys(job)){
    const entry=lookup.byExactKey.get(key)
    if(entry) return entry
  }
  for(const key of urlKeys(job)){
    const entry=lookup.byUrl.get(key)
    if(entry) return entry
  }
  return null
}

export function enrichSearchJobsWithNightFlight(items,index={}){
  if(!Array.isArray(items)) return []
  const lookup=buildLookup(index)
  return items.map(item=>{
    const job=item?.job
    if(!job||typeof job!=='object') return item
    const entry=findEntry(job,lookup)
    if(!entry) return item
    return {
      ...item,
      job:{
        ...job,
        nightFlight:publicNightFlightEntry(entry),
      },
    }
  })
}
