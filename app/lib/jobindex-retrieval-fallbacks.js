const JOBINDEX_ORIGIN='https://www.jobindex.dk'
export const DSB_CURRENT_JOBS_URL='https://www.dsb.dk/om-dsb/job-og-karriere/alle-ledige-stillinger-i-dsb/'

function clean(value){return String(value??'').trim()}
function decodeEntities(value=''){
  return String(value??'')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
}
function attr(tag,name){
  const match=String(tag??'').match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))
  return match?decodeEntities(match[1]).trim():''
}
function plain(value=''){
  return decodeEntities(String(value??'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()
}
function normalizedTitle(value=''){return plain(value).toLowerCase()}
function hostname(value=''){
  try{return new URL(String(value??'')).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}
}
function hostMatches(host,domain){return host===domain||host.endsWith(`.${domain}`)}

export function jobindexCanonicalFullJdUrl(html=''){
  for(const match of String(html??'').matchAll(/<link\b[^>]*>/gi)){
    const tag=match[0]
    if(attr(tag,'rel').toLowerCase()!=='canonical') continue
    const href=attr(tag,'href')
    try{
      const url=new URL(href,JOBINDEX_ORIGIN)
      const host=url.hostname.toLowerCase().replace(/^www\./,'')
      if((host==='jobindex.dk'||host.endsWith('.jobindex.dk'))&&/^\/jobannonce\/h\d+\//i.test(url.pathname)) return url.toString()
    }catch{}
  }
  return ''
}

export function jobindexCanonicalFullJd(html=''){
  const match=String(html??'').match(/<section\b[^>]*class=["'][^"']*\bjobtext-jobad__body\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)
  const value=plain(match?.[1]||'')
  return value.length>=500?value:''
}

export function jobindexApplyTrackerUrl(html=''){
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for(const match of String(html??'').matchAll(re)){
    const label=plain(match[2]).toLowerCase()
    if(!/^(?:søg(?: stillingen)?|apply|ansøg|send ansøgning|gå til job|se jobbet|view job)$/i.test(label)) continue
    const raw=decodeEntities(match[1])
    try{
      const url=new URL(raw,JOBINDEX_ORIGIN)
      const host=url.hostname.toLowerCase().replace(/^www\./,'')
      if((host==='jobindex.dk'||host.endsWith('.jobindex.dk'))&&url.pathname==='/c') return url.toString()
    }catch{}
  }
  return ''
}

function queryValueCaseInsensitive(url,names){
  const wanted=new Set(names.map(name=>name.toLowerCase()))
  for(const [key,value] of url.searchParams.entries()) if(wanted.has(key.toLowerCase())&&value) return value
  return ''
}

export function hrManagerAdvertisementUrl(value=''){
  try{
    const url=new URL(String(value??''))
    const host=url.hostname.toLowerCase().replace(/^www\./,'')
    if(!hostMatches(host,'hr-manager.net')||!/\/ApplicationForm\//i.test(url.pathname)) return ''
    const cid=queryValueCaseInsensitive(url,['cid'])
    const projectId=queryValueCaseInsensitive(url,['ProjectId'])
    const departmentId=queryValueCaseInsensitive(url,['DepartmentId','departmentId'])
    const mediaId=queryValueCaseInsensitive(url,['MediaId'])
    if(!cid||!projectId) return ''
    const out=new URL('/ApplicationInit.aspx',url.origin)
    out.searchParams.set('cid',cid)
    out.searchParams.set('ProjectId',projectId)
    if(departmentId) out.searchParams.set('DepartmentId',departmentId)
    if(mediaId) out.searchParams.set('MediaId',mediaId)
    return out.toString()
  }catch{return ''}
}

export function embeddedHrOnDescriptor(wrapperUrl='',html=''){
  let page
  try{page=new URL(String(wrapperUrl??''))}catch{return null}
  const hr=page.searchParams.get('hr')||''
  const match=hr.match(/(?:^|[?&])?show-job\/(\d+)/i)
  if(!match) return null
  let locale=page.searchParams.get('locale')||''
  if(!locale) locale=hr.match(/[?&]locale=([^&]+)/i)?.[1]||'da_DK'
  let hrScriptUrl=''
  let customerScriptUrl=''
  for(const script of String(html??'').matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)){
    let src=''
    try{src=new URL(decodeEntities(script[1]),page).toString()}catch{continue}
    if(/\/frame-api\/hr\.js(?:[?#]|$)/i.test(src)) hrScriptUrl=src
    else if(/\/frame-api\/customers\/[^/?#]+\.js(?:[?#]|$)/i.test(src)) customerScriptUrl=src
  }
  if(!hrScriptUrl||!customerScriptUrl) return null
  return {jobId:match[1],locale,hrScriptUrl,customerScriptUrl}
}

export function hrOnRootFromScript(script=''){
  return clean(String(script??'').match(/\bHR_WEB_ROOT\s*=\s*["']([^"']+)["']/i)?.[1])
}
export function hrOnCompanyIdFromScript(script=''){
  return clean(String(script??'').match(/\bcompanyId\s*:\s*["']?(\d+)["']?/i)?.[1])
}
export function hrOnFrameUrl({root='',jobId='',companyId='',locale='da_DK'}={}){
  if(!root||!/^\d+$/.test(String(jobId))||!/^\d+$/.test(String(companyId))) return ''
  try{
    const url=new URL(`frame-api/pages/show-job/${jobId}`,root.endsWith('/')?root:`${root}/`)
    url.searchParams.set('companyid',String(companyId))
    url.searchParams.set('locale',locale||'da_DK')
    return url.toString()
  }catch{return ''}
}

export function isDsvCareersUrl(value=''){
  const host=hostname(value)
  return hostMatches(host,'dsv.com')&&!hostMatches(host,'jobs.dsv.com')
}
export function dsvSearchUrl(title=''){
  const url=new URL('https://jobs.dsv.com/search/')
  url.searchParams.set('q',clean(title))
  return url.toString()
}
export function exactTitleJobHref(html='',title='',base=''){
  const wanted=normalizedTitle(title)
  if(!wanted) return ''
  for(const match of String(html??'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    if(normalizedTitle(match[2])!==wanted) continue
    try{return new URL(decodeEntities(match[1]),base).toString()}catch{}
  }
  return ''
}

export function isDsbCareersUrl(value=''){
  const host=hostname(value)
  return hostMatches(host,'dsb.dk')
}
export function dsbAppliedUrlForTitle(html='',title=''){
  const text=String(html??'')
  const escaped=JSON.stringify(clean(title)).slice(1,-1).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const marker=new RegExp(`"title"\\s*:\\s*"${escaped}"`,'i').exec(text)
  if(!marker) return ''
  const chunk=text.slice(marker.index,marker.index+5000)
  const match=chunk.match(/"appliedUrl"\s*:\s*"((?:\\.|[^"\\])*)"/i)
  if(!match) return ''
  try{return JSON.parse(`"${match[1]}"`)}catch{return decodeEntities(match[1].replace(/\\u0026/gi,'&').replace(/\\\//g,'/'))}
}
