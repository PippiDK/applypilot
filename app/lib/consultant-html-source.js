import { normalizeJob } from './normalized-job.js'
import { consultantPortal } from './consultant-portals.js'
import { extractSourceDate, sourceWithinFreshness, stripSourceHtml } from './source-freshness.js'

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
async function fetchText(fetcher,url){const r=await fetcher(url,{headers:{accept:'text/html,application/xhtml+xml'}});if(!r?.ok)throw new Error(`Consultant portal HTTP ${r?.status||'error'}`);return r.text()}
function links(html,baseUrl,pattern){const out=[];const seen=new Set();const re=/href=["']([^"']+)["']/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1],baseUrl);const href=u.origin+u.pathname;if(!href.includes(pattern))continue;if(href.endsWith(pattern))continue;if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}return out}
function titleFrom(html=''){const h1=String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(h1)return stripSourceHtml(h1[1]);const og=String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);return clean(og?.[1]||'')}
function textField(text,label){const re=new RegExp(label+'\\s*:?\\s*([^\\n]{2,180})','i');return clean((String(text).match(re)||[])[1]||'')}
function locationFrom(portalId,text=''){
  if(portalId==='emagine'){
    const m=String(text).match(/(?:Denmark|Danmark)\s*,?\s*([^\n]{0,120})/i)
    return clean(m?.[0]||textField(text,'Location'))
  }
  return textField(text,'Location')||textField(text,'Arbejdssted')||textField(text,'Lokation')
}
function languageFrom(text=''){return textField(text,'Language')||textField(text,'Sprog')}
function relevantDenmark(location,text){const joined=(location+' '+text).toLowerCase();return /(denmark|danmark|copenhagen|københavn|storkøbenhavn|greater copenhagen|lyngby|hellerup|gentofte|ballerup|nærum|nordsjælland)/i.test(joined)}

export async function searchConsultantHtmlPortals({portalIds=[],freshnessDays=7,fetcher=globalThis.fetch}={}){
  const jobs=[];const errors=[];let rawDiscovered=0,discovered=0,fullJdVerified=0,detailRequests=0
  for(const portalId of portalIds){
    const cfg=consultantPortal(portalId)
    if(!cfg||cfg.status!=='connected'||cfg.connector!=='html')continue
    try{
      const listing=await fetchText(fetcher,cfg.baseUrl+cfg.listingPath)
      const found=links(listing,cfg.baseUrl,cfg.detailPattern)
      rawDiscovered+=found.length
      for(const link of found){
        try{
          detailRequests++
          const html=await fetchText(fetcher,link)
          const fullText=stripSourceHtml(html)
          if(portalId==='epico'&&/(Deadline\s*:?\s*Exceeded|Deadline\s*:?\s*Udløbet|Udløbet)/i.test(fullText))continue
          const location=locationFrom(portalId,fullText)
          if(!relevantDenmark(location,fullText))continue
          const publishedAt=extractSourceDate(html,fullText,['Posted','Published','Date posted','Opslået','Publiceret'])
          if(!sourceWithinFreshness(publishedAt,freshnessDays))continue
          discovered++
          if(fullText.length<500)continue
          fullJdVerified++
          const id=link.split('/').filter(Boolean).slice(-2).join(':')
          jobs.push(normalizeJob({
            source:'consultant_portal',sourceJobId:`consultant:${portalId}:${id}`,jobId:`consultant:${portalId}:${id}`,
            title:titleFrom(html),company:cfg.name,location,country:'Denmark',publishedAt,postedDate:publishedAt,
            employmentType:'Contract',fullJd:fullText,description:fullText,originalUrl:link,detailUrl:link,applicationUrl:link,vacancyStatus:'OPEN',
            sourceRecords:[{source:'consultant_portal',portal:cfg.name,detailUrl:link,applicationUrl:link,fullJd:fullText,limitedData:false}],
            consultantPortal:{id:portalId,name:cfg.name,language:languageFrom(fullText)},
          }))
        }catch(error){errors.push(`${cfg.name}: ${error.message}`)}
      }
    }catch(error){errors.push(`${cfg.name}: ${error.message}`)}
  }
  return {source:'consultant_portal',status:errors.length?'partial':'success',jobs,stats:{rawDiscovered,discovered,fullJdVerified,detailRequests,returned:jobs.length},error:errors.slice(0,3).join(' · ')}
}
