import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function stripHtml(html=''){return clean(String(html??'').replace(/<!--[sS]*?-->/g,' ').replace(/<script\b[sS]*?<\/script>/gi,' ').replace(/<style\b[sS]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))}
function links(html,baseUrl){
  const out=[];const seen=new Set();const re=/href=["']([^"']*\/job\/[^"'?#]+)["']/gi;let m
  while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);const href=u.origin+u.pathname;if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}
  return out
}
function jobDescription(html=''){
  const match=String(html).match(/<div[^>]+class=["'][^"']*jobdescription[^"']*["'][^>]*>([sS]*?)<\/div>/i)
  return stripHtml(match?match[1]:html)
}
function titleFromHtml(html=''){
  const h1=String(html).match(/<h1[^>]*>([sS]*?)<\/h1>/i)
  if(h1) return stripHtml(h1[1])
  const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  return clean(og?.[1]||'')
}
function locationFromText(text=''){
  const m=String(text).match(/(?:Location|Location\(s\)|Lokation)\s*:?\s*([^\n]{2,120})/i)
  return clean(m?.[1]||'')
}
function publishedFromText(text=''){
  const m=String(text).match(/(?:Date posted|Posted|Publication Date)\s*:?\s*([A-Za-z0-9, .\/-]{5,40})/i)
  return m?.[1]?new Date(m[1]).toISOString():null
}
function withinFreshness(value,days){if(!value)return true;const d=new Date(value);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(days)*86400000+86400000}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Company site HTTP ${r?.status||'error'}`);return r.text()}

export async function searchSuccessFactorsCompanies({companies=[],freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch,maxPages=2}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='successfactors')
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(d=>clean(d?.query||d?.role)).filter(Boolean)
  const queries=[...new Set(directions.length?directions:['project manager','delivery manager','implementation manager','integration manager','digital transformation'])]
  const jobs=[];const errors=[];let discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company);const foundLinks=new Set()
    for(const q of queries){
      for(let page=0;page<maxPages;page++){
        try{
          const searchPath=cfg.searchPath||cfg.listingPath||'/search/'
          const url=new URL(cfg.baseUrl+searchPath)
          url.searchParams.set('q',q)
          if(page>0) url.searchParams.set('startrow',String(page*25))
          const html=await fetchText(fetcher,url.toString())
          const pageLinks=links(html,cfg.baseUrl)
          const before=foundLinks.size;pageLinks.forEach(link=>foundLinks.add(link))
          if(foundLinks.size===before) break
        }catch(error){errors.push(`${company}: ${error.message}`);break}
      }
    }
    discovered+=foundLinks.size
    for(const link of foundLinks){
      try{
        detailRequests++
        const html=await fetchText(fetcher,link)
        const text=stripHtml(html)
        const fullJd=jobDescription(html)
        if(fullJd.length<500) continue
        const publishedAt=publishedFromText(text)
        if(!withinFreshness(publishedAt,freshnessDays)) continue
        const title=titleFromHtml(html)
        const location=locationFromText(text)
        const lowerLoc=location.toLowerCase()
        const lowerText=text.toLowerCase()
        if(location&&!(lowerLoc.includes('dk')||lowerLoc.includes('denmark')||lowerText.includes('denmark'))) continue
        fullJdVerified++
        const sourceId=link.split('/').filter(Boolean).pop()||link
        jobs.push(normalizeJob({
          source:'company_site',
          sourceJobId:`company:${company}:${sourceId}`,
          jobId:`company:${company}:${sourceId}`,
          title,company,location,country:'Denmark',
          publishedAt,postedDate:publishedAt,
          fullJd,description:fullJd,
          originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
