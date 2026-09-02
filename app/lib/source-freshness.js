function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}

export function stripSourceHtml(html=''){
  return clean(String(html??'')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>'))
}

function findJobPosting(value){
  if(Array.isArray(value)){for(const item of value){const found=findJobPosting(item);if(found)return found}return null}
  if(!value||typeof value!=='object')return null
  const type=Array.isArray(value['@type'])?value['@type'].join(' '):value['@type']
  if(String(type||'').toLowerCase().includes('jobposting'))return value
  if(value['@graph'])return findJobPosting(value['@graph'])
  return null
}

export function parseJobPostingJsonLd(html=''){
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while((m=re.exec(String(html)))){
    try{
      const parsed=JSON.parse(m[1])
      const found=findJobPosting(parsed)
      if(found)return found
    }catch{}
  }
  return null
}

export function structuredLocation(posting={}){
  const loc=Array.isArray(posting?.jobLocation)?posting.jobLocation[0]:posting?.jobLocation
  const address=loc?.address||{}
  return clean([address.addressLocality,address.addressRegion,address.addressCountry].filter(Boolean).join(', '))
}

function dateFromParts(day,month,year){
  const d=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)))
  return Number.isFinite(d.getTime())?d.toISOString():null
}

export function parseSourceDate(value,now=new Date()){
  if(!value)return null
  const raw=clean(value)
  const lower=raw.toLowerCase()
  if(/^(today|just posted|i dag)$/.test(lower))return now.toISOString()
  let m=lower.match(/(\d+)\s+(?:day|days|dag|dage)\s+(?:ago|siden)/)
  if(m)return new Date(now.getTime()-Number(m[1])*86400000).toISOString()
  m=raw.match(/\b(\d{2})[.\/-](\d{2})[.\/-](\d{4})\b/)
  if(m)return dateFromParts(m[1],m[2],m[3])
  m=raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if(m)return dateFromParts(m[3],m[2],m[1])
  const d=new Date(raw)
  return Number.isFinite(d.getTime())?d.toISOString():null
}

export function extractSourceDate(html='',text='',labels=[]){
  const posting=parseJobPostingJsonLd(html)
  const structured=parseSourceDate(posting?.datePosted||posting?.datePublished||null)
  if(structured)return structured
  const metaPatterns=[
    /<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|datePosted|publish-date|pubdate)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|datePublished|datePosted|publish-date|pubdate)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ]
  for(const re of metaPatterns){
    const m=String(html).match(re)
    const parsed=parseSourceDate(m?.[1])
    if(parsed)return parsed
  }
  for(const label of labels){
    const re=new RegExp(label+'\\s*:?\\s*([^\\n]{2,80})','i')
    const m=String(text).match(re)
    const parsed=parseSourceDate(m?.[1])
    if(parsed)return parsed
  }
  return null
}

export function sourceWithinFreshness(value,days,now=new Date()){
  if(!value)return false
  const d=new Date(value)
  if(!Number.isFinite(d.getTime()))return false
  const age=now.getTime()-d.getTime()
  return age>=-86400000&&age<=Number(days)*86400000+86400000
}
