const BASE='https://www.jobindex.dk'

function clean(value){return String(value??'').trim()}
function decodeHtml(value){return clean(value)
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<\/p\s*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/\s+/g,' ')
  .trim()}

export function jobindexDetailUrl(jobId){
  const id=clean(jobId)
  return /^h\d+$/i.test(id)?`${BASE}/vis-job/${id}`:''
}

export function extractJobindexSearchRecords(html=''){
  const text=String(html??'')
  const ids=[]
  const seen=new Set()
  const re=/(?:https?:\/\/(?:www\.)?jobindex\.dk)?\/vis-job\/(h\d+)/gi
  for(const match of text.matchAll(re)){
    const jobId=match[1]
    if(seen.has(jobId)) continue
    seen.add(jobId)
    ids.push({jobId,detailUrl:jobindexDetailUrl(jobId)})
  }
  return ids
}

function findJobPosting(value){
  if(!value||typeof value!=='object') return null
  if(Array.isArray(value)){
    for(const item of value){const found=findJobPosting(item);if(found) return found}
    return null
  }
  const type=value['@type']
  if(type==='JobPosting'||(Array.isArray(type)&&type.includes('JobPosting'))) return value
  if(value['@graph']) return findJobPosting(value['@graph'])
  return null
}

function parseJsonLd(html){
  const re=/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for(const match of String(html??'').matchAll(re)){
    try{
      const parsed=JSON.parse(match[1].trim())
      const posting=findJobPosting(parsed)
      if(posting) return posting
    }catch{}
  }
  return null
}

function locationFromPosting(posting){
  const locations=Array.isArray(posting?.jobLocation)?posting.jobLocation:[posting?.jobLocation]
  for(const entry of locations){
    const address=entry?.address||entry
    if(!address) continue
    const parts=[address.addressLocality,address.addressRegion,address.addressCountry].map(clean).filter(Boolean)
    if(parts.length) return parts.join(', ')
  }
  return clean(posting?.jobLocationType)
}

function applicationUrlFromHtml(html){
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for(const match of String(html??'').matchAll(re)){
    const href=clean(match[1])
    const label=decodeHtml(match[2]).toLowerCase()
    if(!/^https?:\/\//i.test(href)) continue
    if(href.toLowerCase().startsWith(BASE)) continue
    if(/søg|apply|ansøg|send ansøgning|gå til job/i.test(label)) return href
  }
  return ''
}

export function extractJobindexDetail(html='',context={}){
  const posting=parseJsonLd(html)
  const detailUrl=clean(posting?.url)||jobindexDetailUrl(context?.jobId)
  const title=clean(posting?.title)
  const company=clean(posting?.hiringOrganization?.name)
  const location=locationFromPosting(posting)
  const postedDate=clean(posting?.datePosted)||null
  const fullJd=decodeHtml(posting?.description)
  const applicationUrl=applicationUrlFromHtml(html)
  return {
    jobId:clean(context?.jobId),
    title,
    company,
    location,
    postedDate,
    detailUrl,
    applicationUrl,
    fullJd,
  }
}
