import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'
import { extractSourceDate, sourceWithinFreshness, stripSourceHtml } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function links(html,baseUrl,pattern){const out=[];const seen=new Set();const re=/href=["']([^"']+)["']/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);if(!u.toString().includes(pattern))continue;const href=u.toString();if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}return out}
function titleFrom(html=''){const h1=String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(h1)return stripSourceHtml(h1[1]);const h2=String(html).match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);if(h2)return stripSourceHtml(h2[1]);const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);return clean(og?.[1]||'')}
function textField(text,label){const re=new RegExp(label+'\\s*:?\\s*([^\\n]{2,160})','i');return clean((String(text).match(re)||[])[1]||'')}
function dateField(text,labels=[]){for(const label of labels){const raw=textField(text,label);if(raw){const d=new Date(raw);if(Number.isFinite(d.getTime()))return d.toISOString()}}return null}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Custom careers HTTP ${r?.status||'error'}`);return r.text()}

function parseCompanyDetail(company,html){
  const text=stripSourceHtml(html)
  const publishedAt=extractSourceDate(html,text,['Posted','Date posted','Published','Publication date','Opslået','Publiceret'])
  if(company==='COWI')return {title:titleFrom(html),location:textField(text,'Location'),publishedAt,applicationDeadline:dateField(text,['Application Deadline']),fullJd:text,employmentType:''}
  if(company==='Ørsted')return {title:titleFrom(html),location:clean([textField(text,'Location'),textField(text,'Country')].filter(Boolean).join(', ')),publishedAt,applicationDeadline:dateField(text,['Application deadline']),fullJd:text,employmentType:textField(text,'Employment type')}
  return {title:titleFrom(html),location:textField(text,'Location'),publishedAt,applicationDeadline:null,fullJd:text,employmentType:''}
}

export async function searchCustomHtmlCompanies({companies=[],freshnessDays=7,fetcher=globalThis.fetch}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='custom_html')
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company)
    try{
      const listing=await fetchText(fetcher,cfg.baseUrl+cfg.listingPath)
      const found=links(listing,cfg.baseUrl,cfg.detailPattern)
      rawDiscovered+=found.length
      for(const link of found){
        try{
          detailRequests++
          const html=await fetchText(fetcher,link)
          const detail=parseCompanyDetail(company,html)
          if(!sourceWithinFreshness(detail.publishedAt,freshnessDays))continue
          if(company==='COWI'&&detail.location&&!/(denmark|copenhagen|lyngby)/i.test(detail.location))continue
          if(company==='Ørsted'&&detail.location&&!/(denmark|gentofte|copenhagen)/i.test(detail.location))continue
          discovered++
          if(detail.fullJd.length<500)continue
          fullJdVerified++
          const id=(link.match(/[?&]id=([^&]+)/)||link.match(/\/([0-9]{4,})-[^/]+$/)||[])[1]||link
          jobs.push(normalizeJob({
            source:'company_site',sourceJobId:`company:${company}:${id}`,jobId:`company:${company}:${id}`,
            title:detail.title,company,location:detail.location,country:'Denmark',publishedAt:detail.publishedAt,postedDate:detail.publishedAt,
            applicationDeadline:detail.applicationDeadline,employmentType:detail.employmentType,fullJd:detail.fullJd,description:detail.fullJd,
            originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
            sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd:detail.fullJd,limitedData:false}],
          }))
        }catch(error){errors.push(`${company}: ${error.message}`)}
      }
    }catch(error){errors.push(`${company}: ${error.message}`)}
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
