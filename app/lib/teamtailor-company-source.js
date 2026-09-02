import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function decode(html=''){return clean(String(html??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))}
function stripHtml(html=''){return decode(String(html??'').replace(/<!--[sS]*?-->/g,' ').replace(/<script\b[sS]*?<\/script>/gi,' ').replace(/<style\b[sS]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' '))}
function withinFreshness(value,days){
  if(!value) return true
  const d=new Date(value); if(!Number.isFinite(d.getTime())) return true
  return Date.now()-d.getTime()<=Number(days)*86400000+86400000
}
function jobLinks(html,baseUrl){
  const out=[]; const seen=new Set(); const re=/href=["']([^"']*\/jobs\/[^"'?#]+)["']/gi; let m
  while((m=re.exec(html))){
    try{
      const u=new URL(m[1],baseUrl)
      if(!u.pathname.match(/^\/jobs\/[^/]+/)) continue
      const href=u.origin+u.pathname
      if(!seen.has(href)){seen.add(href);out.push(href)}
    }catch{}
  }
  return out
}
function findJobPosting(value){
  if(Array.isArray(value)){for(const item of value){const found=findJobPosting(item);if(found)return found}return null}
  if(!value||typeof value!=='object') return null
  const type=Array.isArray(value['@type'])?value['@type'].join(' '):value['@type']
  if(String(type||'').toLowerCase().includes('jobposting')) return value
  if(value['@graph']) return findJobPosting(value['@graph'])
  return null
}
function parseJsonLd(html){
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([sS]*?)<\/script>/gi;let m
  while((m=re.exec(html))){
    try{const found=findJobPosting(JSON.parse(m[1]));if(found)return found}catch{}
  }
  return null
}
function locationText(posting={}){
  const loc=Array.isArray(posting.jobLocation)?posting.jobLocation[0]:posting.jobLocation
  const address=loc?.address||{}
  return clean([address.addressLocality,address.addressRegion,address.addressCountry].filter(Boolean).join(', '))
}

async function fetchText(fetcher,url){
  const res=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}})
  if(!res?.ok) throw new Error(`Company site HTTP ${res?.status||'error'}`)
  return res.text()
}

export async function searchTeamtailorCompanies({companies=[],freshnessDays=7,fetcher=globalThis.fetch,maxPages=5}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='teamtailor')
  const jobs=[]; const errors=[]; let discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company)
    const links=[]; const seen=new Set()
    for(let page=1;page<=maxPages;page++){
      try{
        const html=await fetchText(fetcher,`${cfg.baseUrl}/jobs${page>1?`?page=${page}`:''}`)
        const pageLinks=jobLinks(html,cfg.baseUrl)
        let added=0
        for(const link of pageLinks){if(!seen.has(link)){seen.add(link);links.push(link);added++}}
        if(!added) break
      }catch(error){errors.push(`${company}: ${error.message}`);break}
    }
    discovered+=links.length
    for(const link of links){
      try{
        detailRequests++
        const html=await fetchText(fetcher,link)
        const posting=parseJsonLd(html)
        if(!posting) continue
        const publishedAt=posting.datePosted||null
        if(!withinFreshness(publishedAt,freshnessDays)) continue
        const fullJd=stripHtml(posting.description||'')
        if(fullJd.length<500) continue
        fullJdVerified++
        const sourceJobId=clean(posting.identifier?.value||posting.identifier||link.split('/jobs/')[1]||link)
        jobs.push(normalizeJob({
          source:'company_site',
          sourceJobId:`company:${company}:${sourceJobId}`,
          jobId:`company:${company}:${sourceJobId}`,
          title:clean(posting.title),
          company,
          location:locationText(posting),
          country:clean((Array.isArray(posting.jobLocation)?posting.jobLocation[0]:posting.jobLocation)?.address?.addressCountry||''),
          publishedAt,
          postedDate:publishedAt,
          applicationDeadline:posting.validThrough||null,
          employmentType:clean(Array.isArray(posting.employmentType)?posting.employmentType.join(', '):posting.employmentType),
          fullJd,
          description:fullJd,
          originalUrl:link,
          detailUrl:link,
          applicationUrl:link,
          vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
