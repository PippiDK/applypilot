import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { sourceWithinFreshness, stripSourceHtml } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function withinFreshness(value,days){if(!value)return true;const d=new Date(value);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(days)*86400000+86400000}
async function getJson(fetcher,url){const r=await fetcher(url,{headers:{accept:'application/json'}});if(!r?.ok)throw new Error(`Oracle careers HTTP ${r?.status||'error'}`);return r.json()}
function requisitionRows(data={}){
  if(Array.isArray(data?.items)) return data.items.flatMap(item=>Array.isArray(item?.requisitionList)?item.requisitionList:[])
  return []
}
function detailRecord(data={}){
  if(!Array.isArray(data?.items)||!data.items.length) return null
  return data.items[0]
}
function locationText(record={}){
  const values=[record.PrimaryLocation,record.PrimaryLocationCountry,record.WorkLocation,record.Location,record.locationsText,record.LocationName]
  return clean(values.filter(Boolean).join(' · '))
}
function publishedAt(record={}){
  return record.PostedDate||record.ExternalPostedStartDate||record.PostingStartDate||record.CreationDate||null
}
function reqId(record={}){
  return clean(record.Id||record.RequisitionId||record.RequisitionNumber||record.JobId||'')
}
function title(record={}){return clean(record.Title||record.JobTitle||record.RequisitionTitle||'')}
function description(record={}){
  return stripSourceHtml(record.JobDescription||record.ExternalDescriptionStr||record.ExternalDescription||record.Description||record.JobDescriptionExternal||'')
}
function detailUrl(cfg,id){return `${cfg.host}/hcmUI/CandidateExperience/en/sites/${cfg.site}/job/${encodeURIComponent(id)}`}

export async function searchOracleCompanies({companies=[],freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch,limit=100}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='oracle')
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[]).map(d=>clean(d?.query||d?.role)).filter(Boolean)
  const queries=[...new Set(directions.length?directions:['project manager','delivery manager','implementation manager','integration manager','digital transformation'])]
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0

  for(const company of selected){
    const cfg=companyConnection(company)
    const found=new Map()
    for(const query of queries){
      try{
        const finderParts=[`siteNumber=${cfg.site}`,`limit=${limit}`,`keyword=${query}`]
        if(cfg.country) finderParts.push(`location=${cfg.country}`)
        const url=new URL(`${cfg.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`)
        url.searchParams.set('onlyData','true')
        url.searchParams.set('expand','requisitionList')
        url.searchParams.set('finder',`findReqs;${finderParts.join(',')}`)
        const data=await getJson(fetcher,url.toString())
        for(const row of requisitionRows(data)){
          const id=reqId(row)
          if(id) found.set(id,row)
        }
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }

    rawDiscovered+=found.size

    for(const [id,summary] of found){
      try{
        detailRequests++
        const url=new URL(`${cfg.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`)
        url.searchParams.set('expand','all')
        url.searchParams.set('onlyData','true')
        url.searchParams.set('finder',`ById;Id="${id}",siteNumber=${cfg.site}`)
        const data=await getJson(fetcher,url.toString())
        const detail=detailRecord(data)||summary
        const posted=publishedAt(detail)||publishedAt(summary)
        if(!sourceWithinFreshness(posted,freshnessDays)) continue
        const fullJd=description(detail)
        if(fullJd.length<500) continue
        const location=locationText(detail)||locationText(summary)
        if(cfg.country&&location&&!location.toLowerCase().includes(String(cfg.country).toLowerCase())&&!location.toLowerCase().includes('dk')&&!location.toLowerCase().includes('copenhagen')&&!location.toLowerCase().includes('aarhus')) continue
        discovered++
        fullJdVerified++
        const openUrl=detailUrl(cfg,id)
        jobs.push(normalizeJob({
          source:'company_site',
          sourceJobId:`company:${company}:${id}`,
          jobId:`company:${company}:${id}`,
          title:title(detail)||title(summary),
          company,
          location,
          country:cfg.country||'',
          publishedAt:posted,
          postedDate:posted,
          employmentType:clean(detail.WorkerType||detail.JobType||detail.EmploymentType||''),
          fullJd,
          description:fullJd,
          originalUrl:openUrl,
          detailUrl:openUrl,
          applicationUrl:openUrl,
          vacancyStatus:'OPEN',
          sourceRecords:[{source:'company_site',company,detailUrl:openUrl,applicationUrl:openUrl,fullJd,limitedData:false}],
        }))
      }catch(error){errors.push(`${company}: ${error.message}`)}
    }
  }

  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
