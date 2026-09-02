import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { extractSourceDate, sourceWithinFreshness, stripSourceHtml } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Legacy SuccessFactors HTTP ${r?.status||'error'}`);return r.text()}
function links(html,base){const out=[];const seen=new Set();const re=/href=["']([^"']*(?:career\?[^"']*jobId=\d+|job\/[^"'?#]+))["']/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1],base);const href=u.toString();if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}return out}
function titleFrom(html=''){const h1=String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(h1)return stripSourceHtml(h1[1]);const t=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);return stripSourceHtml(t?.[1]||'')}
function locationFrom(text=''){const m=String(text).match(/(?:Location|Lokation|Sted)\s*:?\s*([^\n]{2,120})/i);return clean(m?.[1]||'')}

export async function searchLegacySuccessFactorsCompanies({companies=[],freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='successfactors_legacy')
  const queries=[...new Set((Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(d=>clean(d?.query||d?.role)).filter(Boolean))]
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company);const found=new Set()
    for(const q of queries.length?queries:['project manager','delivery manager','implementation manager','integration manager','digital transformation']){
      try{
        const u=new URL('/career',cfg.baseUrl)
        u.searchParams.set('company',cfg.company)
        u.searchParams.set('career_ns','job_listing_summary')
        u.searchParams.set('navBarLevel','JOB_SEARCH')
        u.searchParams.set('search','Search')
        u.searchParams.set('jobSearchText',q)
        const html=await fetchText(fetcher,u.toString())
        links(html,cfg.baseUrl).forEach(x=>found.add(x))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
    rawDiscovered+=found.size
    for(const link of found){
      try{
        detailRequests++
        const html=await fetchText(fetcher,link)
        const fullText=stripSourceHtml(html)
        const publishedAt=extractSourceDate(html,fullText,['Posted','Date posted','Opslået','Publiceret','Published'])
        if(!sourceWithinFreshness(publishedAt,freshnessDays))continue
        const location=locationFrom(fullText)
        if(cfg.country&&location&&!location.toLowerCase().includes(String(cfg.country).toLowerCase())&&!location.toLowerCase().includes('copenhagen')&&!location.toLowerCase().includes('hellerup'))continue
        discovered++
        if(fullText.length<500)continue
        fullJdVerified++
        const id=(link.match(/[?&]jobId=(\d+)/)||[])[1]||link
        jobs.push(normalizeJob({source:'company_site',sourceJobId:`company:${company}:${id}`,jobId:`company:${company}:${id}`,title:titleFrom(html),company,location,country:cfg.country||'',publishedAt,postedDate:publishedAt,fullJd:fullText,description:fullText,originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd:fullText,limitedData:false}]}))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
