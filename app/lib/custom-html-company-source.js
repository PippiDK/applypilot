import { normalizeJob } from './normalized-job.js'
import { companyConnection } from './company-watch.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function decode(html=''){return clean(String(html??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))}
function stripHtml(html=''){return decode(String(html??'').replace(/<!--[sS]*?-->/g,' ').replace(/<script\b[sS]*?<\/script>/gi,' ').replace(/<style\b[sS]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' '))}
function links(html,baseUrl,pattern){
  const out=[];const seen=new Set();const re=/href=["']([^"']+)["']/gi;let m
  while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);if(!u.toString().includes(pattern))continue;const href=u.toString();if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}
  return out
}
function titleFrom(html=''){const h1=String(html).match(/<h1[^>]*>([sS]*?)<\/h1>/i);if(h1)return stripHtml(h1[1]);const h2=String(html).match(/<h2[^>]*>([sS]*?)<\/h2>/i);if(h2)return stripHtml(h2[1]);const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);return clean(og?.[1]||'')}
function textField(text,label){const re=new RegExp(label+'\\s*:?\\s*([^\\n]{2,160})','i');return clean((String(text).match(re)||[])[1]||'')}
function dateField(text,labels=[]){for(const label of labels){const raw=textField(text,label);if(raw){const d=new Date(raw);if(Number.isFinite(d.getTime()))return d.toISOString()}}return null}
function withinFreshness(value,days){if(!value)return true;const d=new Date(value);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(days)*86400000+86400000}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Custom careers HTTP ${r?.status||'error'}`);return r.text()}

function parseCompanyDetail(company,html,url){
  const text=stripHtml(html)
  if(company==='COWI'){
    const title=titleFrom(html)
    const location=textField(text,'Location')
    const deadline=dateField(text,['Application Deadline'])
    const fullJd=text
    return {title,location,publishedAt:null,applicationDeadline:deadline,fullJd,employmentType:''}
  }
  if(company==='Ørsted'){
    const title=titleFrom(html)
    const location=textField(text,'Location')
    const country=textField(text,'Country')
    const employmentType=textField(text,'Employment type')
    const deadline=dateField(text,['Application deadline'])
    const fullJd=text
    return {title,location:clean([location,country].filter(Boolean).join(', ')),publishedAt:null,applicationDeadline:deadline,fullJd,employmentType}
  }
  return {title:titleFrom(html),location:'',publishedAt:null,applicationDeadline:null,fullJd:text,employmentType:''}
}

export async function searchCustomHtmlCompanies({companies=[],freshnessDays=7,fetcher=globalThis.fetch}={}){
  const selected=(Array.isArray(companies)?companies:[]).filter(name=>companyConnection(name).connector==='custom_html')
  const jobs=[];const errors=[];let discovered=0,fullJdVerified=0,detailRequests=0
  for(const company of selected){
    const cfg=companyConnection(company)
    try{
      const listing=await fetchText(fetcher,cfg.baseUrl+cfg.listingPath)
      const found=links(listing,cfg.baseUrl,cfg.detailPattern)
      discovered+=found.length
      for(const link of found){
        try{
          detailRequests++
          const html=await fetchText(fetcher,link)
          const detail=parseCompanyDetail(company,html,link)
          if(detail.fullJd.length<500)continue
          if(!withinFreshness(detail.publishedAt,freshnessDays))continue
          if(company==='COWI'&&detail.location&&!/(denmark|copenhagen|lyngby)/i.test(detail.location))continue
          if(company==='Ørsted'&&detail.location&&!/(denmark|gentofte|copenhagen)/i.test(detail.location))continue
          fullJdVerified++
          const id=(link.match(/[?&]id=([^&]+)/)||link.match(/\/([0-9]{4,})-[^/]+$/)||[])[1]||link
          jobs.push(normalizeJob({
            source:'company_site',
            sourceJobId:`company:${company}:${id}`,
            jobId:`company:${company}:${id}`,
            title:detail.title,
            company,
            location:detail.location,
            country:'Denmark',
            publishedAt:detail.publishedAt,
            postedDate:detail.publishedAt,
            applicationDeadline:detail.applicationDeadline,
            employmentType:detail.employmentType,
            fullJd:detail.fullJd,
            description:detail.fullJd,
            originalUrl:link,
            detailUrl:link,
            applicationUrl:link,
            vacancyStatus:'OPEN',
            sourceRecords:[{source:'company_site',company,detailUrl:link,applicationUrl:link,fullJd:detail.fullJd,limitedData:false}],
          }))
        }catch(error){errors.push(`${company}: ${error.message}`)}
      }
    }catch(error){errors.push(`${company}: ${error.message}`)}
  }
  return {source:'company_site',status:errors.length?'partial':'success',jobs,stats:{discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
