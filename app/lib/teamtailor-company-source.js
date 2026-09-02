import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { parseJobPostingJsonLd, sourceWithinFreshness, stripSourceHtml, structuredLocation } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function jobLinks(html,baseUrl){
  const out=[];const seen=new Set();const re=/href=["']([^"']*\/jobs\/[^"'?#]+)["']/gi;let m
  while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);if(!u.pathname.match(/^\/jobs\/[^/]+/))continue;const href=u.origin+u.pathname;if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}
  return out
}
async function fetchText(fetcher,url){const res=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!res?.ok)throw new Error(`Company site HTTP ${res?.status||'error'}`);return res.text()}

export async function searchTeamtailorCompanies({companies=[],freshnessDays=7,fetcher=globalThis.fetch,maxPages=5}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='teamtailor')
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company)
    const links=[];const seen=new Set()
    for(let page=1;page<=maxPages;page++){
      try{
        const html=await fetchText(fetcher,`${cfg.baseUrl}/jobs${page>1?`?page=${page}`:''}`)
        const pageLinks=jobLinks(html,cfg.baseUrl)
        let added=0
        for(const link of pageLinks){if(!seen.has(link)){seen.add(link);links.push(link);added++}}
        if(!added)break
      }catch(error){errors.push(`${company}: ${error.message}`);break}
    }
    rawDiscovered+=links.length
    for(const link of links){
      try{
        detailRequests++
        const html=await fetchText(fetcher,link)
        const posting=parseJobPostingJsonLd(html)
        if(!posting)continue
        const publishedAt=posting.datePosted||posting.datePublished||null
        if(!sourceWithinFreshness(publishedAt,freshnessDays))continue
        const location=structuredLocation(posting)
        const country=clean((Array.isArray(posting.jobLocation)?posting.jobLocation[0]:posting.jobLocation)?.address?.addressCountry||'')
        if(country&&!/(denmark|danmark|dk)/i.test(country))continue
        discovered++
        const fullJd=stripSourceHtml(posting.description||'')
        if(fullJd.length<500)continue
        fullJdVerified++
        const sourceJobId=clean(posting.identifier?.value||posting.identifier||link.split('/jobs/')[1]||link)
        jobs.push(normalizeJob({
          source:'company_site',sourceJobId:`company:${company}:${sourceJobId}`,jobId:`company:${company}:${sourceJobId}`,
          title:clean(posting.title),company,location,country,publishedAt,postedDate:publishedAt,applicationDeadline:posting.validThrough||null,
          employmentType:clean(Array.isArray(posting.employmentType)?posting.employmentType.join(', '):posting.employmentType),
          fullJd,description:fullJd,originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
