// Etteplan's official careers board links to Jobylon. Isolated source adapter.
import {normalizeJob} from './normalized-job.js'
import {extractSourceDate,parseJobPostingJsonLd,structuredLocation,sourceWithinFreshness,stripSourceHtml} from './source-freshness.js'

export const ETTEPLAN_CAREERS_URL='https://www.etteplan.com/careers/open-positions/apply-now/'
const jobylonPattern=/https?:\/\/emp\.jobylon\.com\/jobs\/([0-9]+)-[^"'<>\s?#/]+\/?/gi
const tidy=value=>String(value??'').replace(/\s+/g,' ').trim()

export function extractEtteplanJobLinks(html=''){
 const result=[];const seen=new Set();let match
 for(const source of [String(html),String(html).replace(/&amp;/g,'&')]){
  jobylonPattern.lastIndex=0
  while((match=jobylonPattern.exec(source))){
   const url=match[0].replace(/\/$/,'/')
   if(seen.has(match[1]))continue
   seen.add(match[1]);result.push({id:match[1],url})
  }
 }
 return result
}
function heading(html){
 const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
 return tidy(stripSourceHtml(h1?.[1]||''))
}
function denmarkLocation(html,posting){
 const structured=structuredLocation(posting)
 if(structured)return /denmark|danmark|herlev|copenhagen|københavn/i.test(structured)?structured:null
 // Only inspect job-page header, NOT the footer where Etteplan lists all its countries.
 const body=stripSourceHtml(html)
 const header=body.slice(0,Math.min(heading(html).length+450,900))
 const match=header.match(/\b(Herlev|Copenhagen|København|Denmark|Danmark)\b/i)
 return match?match[1]+', Denmark':null
}
function employment(html,posting){
 const text=tidy([posting?.employmentType,stripSourceHtml(html).slice(0,2200)].join(' '))
 return /freelance|contract|temporary|fixed.term|konsulentopgave|selvstændig/i.test(text)?'Contract':'Permanent'
}
export async function searchEtteplanJobs({freshnessDays=5,fetcher=globalThis.fetch,now=new Date()}={}){
 const response=await fetcher(ETTEPLAN_CAREERS_URL,{headers:{accept:'text/html'}})
 if(!response.ok)throw new Error('Etteplan careers HTTP '+response.status)
 const links=extractEtteplanJobLinks(await response.text())
 if(!links.length)throw new Error('Etteplan Jobylon links were not found; page structure needs verification')
 const jobs=[];const errors=[];let fullJdVerified=0,undated=0,foreign=0
 for(const {id,url} of links){
  try{
   const r=await fetcher(url,{headers:{accept:'text/html'}})
   if(!r.ok){errors.push('Jobylon '+id+' HTTP '+r.status);continue}
   const html=await r.text()
   const posting=parseJobPostingJsonLd(html)
   const location=denmarkLocation(html,posting)
   if(!location){foreign++;continue}
   const title=tidy(posting?.title||heading(html))
   const fullJd=stripSourceHtml(html)
   if(!title||fullJd.length<500)continue
   fullJdVerified++
   const publishedAt=extractSourceDate(html,fullJd,['Posted on','Published on','Date posted','Opslået den'])
   // Missing published date must not silently become today's date.
   if(!publishedAt){undated++;continue}
   if(!sourceWithinFreshness(publishedAt,freshnessDays,now))continue
   const employmentType=employment(html,posting)
   jobs.push(normalizeJob({
    source:'consultant_portal',sourceJobId:'consultant:etteplan:'+id,jobId:'consultant:etteplan:'+id,
    title,company:'Etteplan',location,country:'Denmark',publishedAt,postedDate:publishedAt,
    employmentType,fullJd,description:fullJd,originalUrl:url,detailUrl:url,applicationUrl:url,
    vacancyStatus:'OPEN',sourceRecords:[{source:'consultant_portal',portal:'Etteplan',detailUrl:url,applicationUrl:url,fullJd,limitedData:false}],
    consultantPortal:{id:'etteplan',name:'Etteplan',language:''}
   }))
  }catch(error){errors.push('Jobylon '+id+': '+error.message)}
 }
 return {jobs,status:errors.length||undated?'partial':'success',stats:{rawDiscovered:links.length,discovered:jobs.length,fullJdVerified,detailRequests:links.length,returned:jobs.length,undated,foreign},error:[...errors.slice(0,2),...(undated?[undated+' Danish Jobylon jobs missing verified posting date']:[])].join(' · ')}
}
