import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function stripHtml(html=''){return clean(String(html??'').replace(/<!--[sS]*?-->/g,' ').replace(/<script\b[sS]*?<\/script>/gi,' ').replace(/<style\b[sS]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))}
function withinFreshness(value,days){if(!value)return true;const d=new Date(value);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(days)*86400000+86400000}
async function getJson(fetcher,url){const r=await fetcher(url,{headers:{accept:'application/json'}});if(!r?.ok)throw new Error(`Workable HTTP ${r?.status||'error'}`);return r.json()}
function location(job={}){return clean(job?.location?.location_str||[job?.city,job?.state,job?.country].filter(Boolean).join(', '))}
function desc(job={}){return stripHtml(job?.full_description||job?.description||job?.requirements||'')}

export async function searchWorkableCompanies({companies=[],freshnessDays=7,fetcher=globalThis.fetch}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='workable')
  const jobs=[];const errors=[];let discovered=0,fullJdVerified=0
  for(const company of selected){
    const cfg=companyConnection(company)
    try{
      const data=await getJson(fetcher,`https://www.workable.com/api/accounts/${cfg.slug}?details=true`)
      const rows=Array.isArray(data?.jobs)?data.jobs:[]
      discovered+=rows.length
      for(const row of rows){
        const country=clean(row?.country||row?.location?.country||row?.location?.country_name||'')
        if(cfg.country&&country&&!country.toLowerCase().includes(String(cfg.country).toLowerCase())) continue
        const publishedAt=row?.published_on||row?.created_at||null
        if(!withinFreshness(publishedAt,freshnessDays)) continue
        const fullJd=desc(row)
        if(fullJd.length<500) continue
        fullJdVerified++
        const id=clean(row?.shortcode||row?.code||row?.id||row?.url)
        const url=clean(row?.url||row?.shortlink||`https://apply.workable.com/${cfg.slug}/`)
        jobs.push(normalizeJob({
          source:'company_site',
          sourceJobId:`company:${company}:${id}`,
          jobId:`company:${company}:${id}`,
          title:clean(row?.title||row?.full_title),
          company,
          location:location(row),
          country:country||cfg.country||'',
          publishedAt,
          postedDate:publishedAt,
          employmentType:clean(row?.employment_type||row?.type||''),
          fullJd,
          description:fullJd,
          originalUrl:url,
          detailUrl:url,
          applicationUrl:clean(row?.application_url||url),
          vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:url,applicationUrl:clean(row?.application_url||url),fullJd,limitedData:false}],
        }))
      }
    }catch(error){errors.push(`${company}: ${error.message}`)}
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{discovered,fullJdVerified,detailRequests:0,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
