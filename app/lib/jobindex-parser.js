const BASE='https://www.jobindex.dk'
const FULL_JD_MIN_LENGTH=500

function clean(value){return String(value??'').trim()}

function decodeEntities(value=''){
  const named={
    nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',
    aelig:'æ',AElig:'Æ',oslash:'ø',Oslash:'Ø',aring:'å',Aring:'Å',
    eacute:'é',Eacute:'É',ndash:'–',mdash:'—',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',bull:'•',hellip:'…',
  }
  return String(value??'')
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))
    .replace(/&([A-Za-z]+);/g,(match,name)=>Object.prototype.hasOwnProperty.call(named,name)?named[name]:match)
}

function decodeHtml(value){return clean(decodeEntities(String(value??'')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')))
  .replace(/\s+/g,' ')
  .trim()}

function cleanContentHtml(value=''){
  return decodeHtml(String(value??'')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi,' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi,' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi,' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi,' ')
    .replace(/<form\b[\s\S]*?<\/form>/gi,' '))
}

function attr(tag,name){
  const match=String(tag??'').match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))
  return match?decodeEntities(match[1]).trim():''
}

function metaContent(html,name){
  const wanted=String(name??'').toLowerCase()
  for(const match of String(html??'').matchAll(/<meta\b[^>]*>/gi)){
    const tag=match[0]
    const key=(attr(tag,'property')||attr(tag,'name')).toLowerCase()
    if(key===wanted) return attr(tag,'content')
  }
  return ''
}

function classBlock(html,classNeedle){
  const escaped=String(classNeedle).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const match=String(html??'').match(new RegExp(`<([a-z0-9]+)\\b[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,'i'))
  return match?.[2]||''
}

function idBlock(html,idNeedle){
  const escaped=String(idNeedle).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const match=String(html??'').match(new RegExp(`<([a-z0-9]+)\\b[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,'i'))
  return match?.[2]||''
}

function companyFromHtml(html){
  const text=decodeHtml(classBlock(html,'jix-toolbar-top__company'))
  if(!text) return ''
  const represented=text.match(/\b(?:søger|rekrutterer)\s+for\s+(.+)$/i)
  return clean(represented?.[1]||text)
}

function locationFromHtml(html){
  return decodeHtml(classBlock(html,'jix_robotjob--area'))
}

function postedDateFromHtml(html){
  const block=classBlock(html,'jix-toolbar__pubdate')
  const timeTag=String(block||html).match(/<time\b[^>]*>/i)?.[0]||''
  return clean(attr(timeTag,'datetime'))||null
}

function paidJobSegment(html){
  const text=String(html??'')
  const open=text.search(/<div\b[^>]*class=["'][^"']*PaidJob-inner[^"']*["'][^>]*>/i)
  if(open<0) return ''
  const start=text.indexOf('>',open)+1
  const tail=text.slice(start)
  const marker=tail.search(/<div\b[^>]*class=["'][^"']*jix_toolbar\b/i)
  return marker>=0?tail.slice(0,marker):tail.slice(0,12000)
}

function safeExternalHref(value){
  const href=clean(decodeEntities(value))
  if(!/^https?:\/\//i.test(href)) return ''
  try{
    const url=new URL(href)
    const host=url.hostname.toLowerCase().replace(/^www\./,'')
    if(host==='jobindex.dk'||host.endsWith('.jobindex.dk')) return ''
    if(/^(?:facebook|linkedin|twitter|instagram|youtube|youtu\.be|vimeo)\.com$/i.test(host)||/(?:^|\.)google\.com$/i.test(host)||host==='youtu.be') return ''
    return href
  }catch{return ''}
}

function applicationUrlFromHtml(html){
  const paid=paidJobSegment(html)
  for(const match of paid.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){
    const href=safeExternalHref(match[1])
    if(href) return href
  }

  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for(const match of String(html??'').matchAll(re)){
    const href=safeExternalHref(match[1])
    if(!href) continue
    const label=decodeHtml(match[2]).toLowerCase()
    if(/søg|apply|ansøg|send ansøgning|gå til job|se jobbet|view job/i.test(label)) return href
  }
  return ''
}

export function jobindexDetailUrl(jobId){
  const id=clean(jobId)
  return /^h\d+$/i.test(id)?`${BASE}/vis-job/${id}`:''
}

function xmlField(item,tag){
  return String(item??'').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]||''
}
function stripCdata(value){return String(value??'').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i,'$1')}
function xmlText(value){return decodeHtml(decodeEntities(stripCdata(value)))}
function jobIdFrom(value){return String(value??'').match(/(?:https?:\/\/(?:www\.)?jobindex\.dk)?\/vis-job\/(h\d+)/i)?.[1]||''}

export function extractJobindexSearchRecords(html=''){
  const text=String(html??'')
  const ids=[]
  const seen=new Set()
  const items=[...text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match=>match[1])

  if(items.length){
    for(const item of items){
      const link=clean(decodeEntities(stripCdata(xmlField(item,'link'))))
      const guid=clean(decodeEntities(stripCdata(xmlField(item,'guid'))))
      const jobId=jobIdFrom(link)||jobIdFrom(guid)||jobIdFrom(item)
      if(!jobId||seen.has(jobId)) continue
      seen.add(jobId)
      ids.push({
        jobId,
        detailUrl:jobindexDetailUrl(jobId),
        title:xmlText(xmlField(item,'title')),
        rssDescription:xmlText(xmlField(item,'description')),
      })
    }
    return ids
  }

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

function addressCountryValue(value){
  if(typeof value==='string') return clean(value)
  if(value&&typeof value==='object') return clean(value.name||value.addressCountry||value['@id'])
  return ''
}

function countryFromPosting(posting){
  const locations=Array.isArray(posting?.jobLocation)?posting.jobLocation:[posting?.jobLocation]
  for(const entry of locations){
    const address=entry?.address||entry
    const country=addressCountryValue(address?.addressCountry)
    if(country) return country
  }
  return ''
}

function locationFromPosting(posting){
  const locations=Array.isArray(posting?.jobLocation)?posting.jobLocation:[posting?.jobLocation]
  for(const entry of locations){
    const address=entry?.address||entry
    if(!address) continue
    const parts=[address.addressLocality,address.addressRegion,addressCountryValue(address.addressCountry)].map(clean).filter(Boolean)
    if(parts.length) return parts.join(', ')
  }
  return clean(posting?.jobLocationType)
}

function remoteTypeFromText(value=''){
  const text=decodeHtml(value).toLowerCase()
  if(/\bhybrid\b/.test(text)) return 'hybrid'
  if(text==='remote'||/\b(fully remote|100% remote|remote role|remote position|work remotely|work from home|home-based)\b/.test(text)) return 'remote'
  if(text==='onsite'||text==='on-site'||text==='on site'||/\b(on-site|onsite|on site|office-based)\b/.test(text)) return 'onsite'
  return ''
}

function remoteTypeFromPosting(posting,fallbackText=''){
  const locationType=clean(posting?.jobLocationType).toLowerCase()
  if(locationType.includes('telecommute')) return 'remote'
  return remoteTypeFromText(`${decodeHtml(posting?.description)} ${fallbackText}`)
}

function emplyExternalCandidate(html=''){
  const value=cleanContentHtml(classBlock(html,'csa_jobadText'))
  return value.length>=FULL_JD_MIN_LENGTH?value:''
}

function successFactorsExternalCandidate(html=''){
  const candidates=[]
  const re=/<span\b([^>]*)>([\s\S]*?)<\/span>/gi
  for(const match of String(html??'').matchAll(re)){
    if(!/\bitemprop=["']description["']/i.test(match[1]||'')) continue
    const value=cleanContentHtml(match[2])
    if(value.length>=FULL_JD_MIN_LENGTH) candidates.push(value)
  }
  return candidates.reduce((best,value)=>value.length>best.length?value:best,'')
}

function hostname(value=''){
  try{return new URL(String(value??'')).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}
}
function hostMatches(host,domain){return host===domain||host.endsWith(`.${domain}`)}
function hostSpecificExternalCandidate(html='',context={}){
  const host=hostname(context?.url)
  let value=''
  if(hostMatches(host,'hr-manager.net')){
    value=cleanContentHtml(classBlock(html,'AdContentContainer'))
    if(value.length<FULL_JD_MIN_LENGTH) value=cleanContentHtml(idBlock(html,'AdvertisementInnerContent'))
  }else if(hostMatches(host,'hr-on.com')) value=cleanContentHtml(classBlock(html,'description'))
  else if(hostMatches(host,'pharmacosmos.com')) value=cleanContentHtml(classBlock(html,'structured-text'))
  return value.length>=FULL_JD_MIN_LENGTH?value:''
}

function semanticExternalCandidates(html='',context={}){
  const text=String(html??'')
  const known=[hostSpecificExternalCandidate(text,context),emplyExternalCandidate(text),successFactorsExternalCandidate(text)].filter(Boolean)
  if(known.length) return known.reduce((best,value)=>value.length>best.length?value:best,'')

  const candidates=[]
  const broad=/<(section|article|main)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  for(const match of text.matchAll(broad)){
    const attrs=match[2]||''
    if(!/(job|vacan|position|career|role|detail|description|posting)/i.test(attrs)) continue
    const value=cleanContentHtml(match[3])
    if(value.length>=FULL_JD_MIN_LENGTH) candidates.push(value)
  }

  const strong=/<div\b([^>]*)>([\s\S]*?)<\/div>/gi
  for(const match of text.matchAll(strong)){
    const attrs=match[1]||''
    if(!/(full[-_ ]?detail[-_ ]?description|job[-_ ]?(description|details?|content|posting)|vacanc(y|ies)[-_ ]?(description|details?|content)|position[-_ ]?(description|details?|content)|role[-_ ]?(description|details?|content))/i.test(attrs)) continue
    const value=cleanContentHtml(match[2])
    if(value.length>=FULL_JD_MIN_LENGTH) candidates.push(value)
  }

  if(!candidates.length) return ''
  const withHeading=candidates.filter(value=>/(stillingsbeskrivelse|job description|about the job|about this role|role description|position description|om stillingen|om jobbet)/i.test(value))
  const pool=withHeading.length?withHeading:candidates
  return pool.reduce((best,value)=>value.length>best.length?value:best,'')
}

export function extractJobindexExternalDetail(html='',context={}){
  const posting=parseJsonLd(html)
  const structured=decodeHtml(posting?.description)
  const fallback=structured.length>=FULL_JD_MIN_LENGTH?'':semanticExternalCandidates(html,context)
  const fullJd=structured.length>=FULL_JD_MIN_LENGTH?structured:fallback
  return {
    url:clean(context?.url),
    title:clean(posting?.title),
    company:clean(posting?.hiringOrganization?.name),
    location:locationFromPosting(posting),
    country:countryFromPosting(posting),
    remoteType:remoteTypeFromPosting(posting,fullJd),
    fullJd:fullJd.length>=FULL_JD_MIN_LENGTH?fullJd:'',
  }
}

export function extractOracleCandidateExperienceDetail(payload='',context={}){
  let root=null
  try{root=typeof payload==='string'?JSON.parse(payload):payload}catch{}
  const item=Array.isArray(root?.items)?root.items[0]:root
  if(!item||typeof item!=='object'){
    return {url:clean(context?.url),title:'',company:'',location:'',country:'',remoteType:'',postedDate:null,fullJd:''}
  }
  const parts=[
    decodeHtml(item.ExternalDescriptionStr),
    decodeHtml(item.ExternalResponsibilitiesStr),
    decodeHtml(item.ExternalQualificationsStr),
  ].filter(Boolean)
  const fullJd=[...new Set(parts)].join('\n\n')
  return {
    url:clean(context?.url),
    title:clean(item.Title||item.OtherRequisitionTitle),
    company:clean(item.LegalEmployer||item.Organization),
    location:clean(item.PrimaryLocation),
    country:clean(item.PrimaryLocationCountry),
    remoteType:remoteTypeFromText(item.WorkplaceType),
    postedDate:clean(item.ExternalPostedStartDate)||null,
    fullJd:fullJd.length>=FULL_JD_MIN_LENGTH?fullJd:'',
  }
}

export function extractJobindexDetail(html='',context={}){
  const posting=parseJsonLd(html)
  const detailUrl=clean(posting?.url)||jobindexDetailUrl(context?.jobId)
  const title=clean(posting?.title)||clean(metaContent(html,'og:title'))
  const company=clean(posting?.hiringOrganization?.name)||companyFromHtml(html)
  const location=locationFromPosting(posting)||locationFromHtml(html)
  const country=countryFromPosting(posting)
  const teaser=decodeHtml(paidJobSegment(html))||clean(metaContent(html,'og:description'))
  const remoteType=remoteTypeFromPosting(posting,`${location} ${teaser}`)
  const postedDate=clean(posting?.datePosted)||postedDateFromHtml(html)
  const fullJd=decodeHtml(posting?.description)
  const applicationUrl=applicationUrlFromHtml(html)
  return {
    jobId:clean(context?.jobId),
    title,
    company,
    location,
    country,
    remoteType,
    postedDate,
    detailUrl,
    applicationUrl,
    teaser,
    fullJd,
  }
}
