import { normalizeJob } from './normalized-job.js'
import { consultantPortal } from './consultant-portals.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function decode(html=''){return clean(String(html??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))}
function stripHtml(html=''){return decode(String(html??'').replace(/<!--[sS]*?-->/g,' ').replace(/<script\b[sS]*?<\/script>/gi,' ').replace(/<style\b[sS]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' '))}
function withinFreshness(value,days){if(!value)return true;const d=new Date(value);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(days)*86400000+86400000}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Consultant portal HTTP ${r?.status||'error'}`);return r.text()}
function links(html,baseUrl,pattern){const out=[];const seen=new Set();const re=/href=["']([^"']+)["']/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);const href=u.origin+u.pathname;if(!href.includes(pattern))continue;if(href.endsWith(pattern))continue;if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}return out}
function titleFrom(html=''){const h1=String(html).match(/<h1[^>]*>([sS]*?)<\/h1>/i);if(h1)return stripHtml(h1[1]);const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);return clean(og?.[1]||'')}
function textField(text,label){const re=new RegExp(label+'\\s*:?\\s*([^\\n]{2,180})','i');return clean((String(text).match(re)||[])[1]||'')}
function dateField(text,labels=[]){for(const label of labels){const raw=textField(text,label);if(raw){const d=new Date(raw);if(Number.isFinite(d.getTime()))return d.toISOString()}}return null}
function locationFrom(portalId,text=''){
  if(portalId==='emagine'){
    const first=clean(String(text).split('\n')[0]||'')
    const m=String(text).match(/Denmark,\s*([^\n]+)/i)
    return clean(m?.[0]||first)
  }
  return textField(text,'Location')||textField(text,'Arbejdssted')
}
function languageFrom(text=''){return textField(text,'Language')||textField(text,'Sprog')}
function publishedFrom(portalId,text=''){
  if(portalId==='right-people-group'){
    const title=String(text).match(/\((\d{2}\.\d{2}\.\d{4})\)/)
    if(title){const [d,m,y]=title[1].split('.').map(Number);return new Date(Date.UTC(y,m-1,d)).toISOString()}
  }
  return dateField(text,['Posted','Published','Date posted'])
}
function relevantDenmark(location,text){const joined=(location+' '+text).toLowerCase();return /(denmark|copenhagen|københavn|storkøbenhavn|greater copenhagen|lyngby|hellerup|gentofte|ballerup|nærum)/i.test(joined)}

export async function searchConsultantHtmlPortals({portalIds=[],freshnessDays=7,fetcher=globalThis.fetch}={}){
  const jobs=[];const errors=[];let discovered=0,fullJdVerified=0,detailRequests=0
  for(const portalId of portalIds){
    const cfg=consultantPortal(portalId)
    if(!cfg||cfg.status!=='connected'||cfg.connector!=='html')continue
    try{
      const listing=await fetchText(fetcher,cfg.baseUrl+cfg.listingPath)
      const found=links(listing,cfg.baseUrl,cfg.detailPattern)
      discovered+=found.length
      for(const link of found){
        try{
          detailRequests++
          const html=await fetchText(fetcher,link)
          const fullJd=stripHtml(html)
          if(fullJd.length<500)continue
          const location=locationFrom(portalId,fullJd)
          if(!relevantDenmark(location,fullJd))continue
          const publishedAt=publishedFrom(portalId,fullJd)
          if(!withinFreshness(publishedAt,freshnessDays))continue
          fullJdVerified++
          const id=link.split('/').filter(Boolean).slice(-2).join(':')
          jobs.push(normalizeJob({
            source:'consultant_portal',
            sourceJobId:`consultant:${portalId}:${id}`,
            jobId:`consultant:${portalId}:${id}`,
            title:titleFrom(html),
            company:cfg.name,
            location,
            country:'Denmark',
            publishedAt,postedDate:publishedAt,
            employmentType:'Contract',
            fullJd,description:fullJd,
            originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
            sourceRecords:[{source:'consultant_portal',portal:cfg.name,detailUrl:link,applicationUrl:link,fullJd,limitedData:false}],
            consultantPortal:{id:portalId,name:cfg.name,language:languageFrom(fullJd)},
          }))
        }catch(error){errors.push(`${cfg.name}: ${error.message}`)}
      }
    }catch(error){errors.push(`${cfg.name}: ${error.message}`)}
  }
  return {source:'consultant_portal',status:errors.length?'partial':'success',jobs,stats:{discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
