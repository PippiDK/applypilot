import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { extractSourceDate, parseJobPostingJsonLd, sourceWithinFreshness, stripSourceHtml, structuredLocation } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function links(html,baseUrl){
  const out=[];const seen=new Set();const re=/href=["']([^"']*\/job\/[^"'?#]+)["']/gi;let m
  while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);const href=u.origin+u.pathname;if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}
  return out
}
function jobDescription(html='',posting=null){
  if(posting?.description)return stripSourceHtml(posting.description)
  const match=String(html).match(/<div[^>]+class=["'][^"']*jobdescription[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  return stripSourceHtml(match?match[1]:html)
}
function titleFromHtml(html='',posting=null){
  if(posting?.title)return clean(posting.title)
  const h1=String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if(h1)return stripSourceHtml(h1[1])
  const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  return clean(og?.[1]||'')
}
function locationFromText(text='',posting=null){
  const structured=structuredLocation(posting||{})
  if(structured)return structured
  const m=String(text).match(/(?:Location|Location\(s\)|Lokation)\s*:?\s*([^\n]{2,120})/i)
  return clean(m?.[1]||'')
}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Company site HTTP ${r?.status||'error'}`);return r.text()}

export async function searchSuccessFactorsCompanies({companies=[],freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch,maxPages=2}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='successfactors')
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(d=>clean(d?.query||d?.role)).filter(Boolean)
  const queries=[...new Set(directions.length?directions:['project manager','delivery manager','implementation manager','integration manager','digital transformation'])]
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company);const foundLinks=new Set()
    for(const q of queries){
      for(let page=0;page<maxPages;page++){
        try{
          const searchPath=cfg.searchPath||cfg.listingPath||'/search/'
          const url=new URL(cfg.baseUrl+searchPath)
          url.searchParams.set('q',q)
          if(page>0)url.searchParams.set('startrow',String(page*25))
          const html=await fetchText(fetcher,url.toString())
          const pageLinks=links(html,cfg.baseUrl)
          const before=foundLinks.size;pageLinks.forEach(link=>foundLinks.add(link))
          if(foundLinks.size===before)break
        }catch(error){errors.push(`${company}: ${error.message}`);break}
      }
    }
    rawDiscovered+=foundLinks.size
    for(const link of foundLinks){
      try{
        detailRequests++
        const html=await fetchText(fetcher,link)
        const posting=parseJobPostingJsonLd(html)
        const text=stripSourceHtml(html)
        const publishedAt=extractSourceDate(html,text,['Date posted','Posted','Publication Date','Published'])
        if(!sourceWithinFreshness(publishedAt,freshnessDays))continue
        const location=locationFromText(text,posting)
        const lowerLoc=location.toLowerCase()
        const lowerText=text.toLowerCase()
        if(location&&!(lowerLoc.includes('dk')||lowerLoc.includes('denmark')||lowerText.includes('denmark')))continue
        discovered++
        const fullJd=jobDescription(html,posting)
        if(fullJd.length<500)continue
        fullJdVerified++
        const title=titleFromHtml(html,posting)
        const sourceId=clean(posting?.identifier?.value||posting?.identifier||link.split('/').filter(Boolean).pop()||link)
        jobs.push(normalizeJob({
          source:'company_site',sourceJobId:`company:${company}:${sourceId}`,jobId:`company:${company}:${sourceId}`,
          title,company,location,country:'Denmark',publishedAt,postedDate:publishedAt,
          employmentType:clean(Array.isArray(posting?.employmentType)?posting.employmentType.join(', '):posting?.employmentType),
          fullJd,description:fullJd,originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
