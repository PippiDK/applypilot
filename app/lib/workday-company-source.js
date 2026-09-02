import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { sourceWithinFreshness, stripSourceHtml } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function relativePostedToDate(value){
  const v=clean(value).toLowerCase()
  if(!v) return null
  const now=new Date()
  if(v.includes('today')||v.includes('just posted')) return now.toISOString()
  const m=v.match(/(\d+)\s+day/)
  if(m){const d=new Date(now.getTime()-Number(m[1])*86400000);return d.toISOString()}
  if(v.includes('30+')){const d=new Date(now.getTime()-31*86400000);return d.toISOString()}
  return null
}
function withinFreshness(value,days){
  if(!value) return true
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return true
  return Date.now()-d.getTime()<=Number(days)*86400000+86400000
}
async function json(fetcher,url,options={}){
  const r=await fetcher(url,{...options,headers:{accept:'application/json','content-type':'application/json',...(options.headers||{})}})
  if(!r?.ok) throw new Error(`Workday HTTP ${r?.status||'error'}`)
  return r.json()
}
function locationText(detail={}){
  if(Array.isArray(detail.jobPostingInfo?.location)) return detail.jobPostingInfo.location.map(clean).filter(Boolean).join(' · ')
  return clean(detail.jobPostingInfo?.location||detail.jobPostingInfo?.additionalLocations||'')
}

export async function searchWorkdayCompanies({companies=[],freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch,limit=50}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='workday')
  const queries=[...new Set((Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(d=>clean(d?.query||d?.role)).filter(Boolean))]
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company)
    const found=new Map()
    for(const q of queries.length?queries:['project manager','delivery manager','implementation manager','integration manager','digital transformation']){
      try{
        const searchUrl=`${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`
        const data=await json(fetcher,searchUrl,{method:'POST',body:JSON.stringify({appliedFacets:{},limit,offset:0,searchText:q})})
        for(const item of Array.isArray(data?.jobPostings)?data.jobPostings:[]){
          const path=clean(item?.externalPath)
          if(!path) continue
          found.set(path,item)
        }
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
    rawDiscovered+=found.size
    for(const [path,summary] of found){
      try{
        detailRequests++
        const detailUrl=`${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}${path}`
        const detail=await json(fetcher,detailUrl)
        const info=detail?.jobPostingInfo||{}
        const publishedAt=relativePostedToDate(info.postedOn||summary?.postedOn)
        if(!sourceWithinFreshness(publishedAt,freshnessDays)) continue
        const fullJd=stripSourceHtml(info.jobDescription||'')
        if(fullJd.length<500) continue
        const location=locationText(detail)||clean(summary?.locationsText)
        const locationTokens=Array.isArray(cfg.locationTokens)?cfg.locationTokens:[]
        if(locationTokens.length&&location&&!locationTokens.some(token=>location.toLowerCase().includes(String(token).toLowerCase()))) continue
        discovered++
        fullJdVerified++
        const reqId=clean(info.jobReqId||path.split('_').pop()||path)
        const originalUrl=`${cfg.host}/en-US/${cfg.site}${path}`
        jobs.push(normalizeJob({
          source:'company_site',
          sourceJobId:`company:${company}:${reqId}`,
          jobId:`company:${company}:${reqId}`,
          title:clean(info.title||summary?.title),
          company,
          location,
          country:'Denmark',
          publishedAt,postedDate:publishedAt,
          employmentType:clean(info.timeType||''),
          fullJd,description:fullJd,
          originalUrl,detailUrl:originalUrl,applicationUrl:originalUrl,vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:originalUrl,applicationUrl:originalUrl,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
