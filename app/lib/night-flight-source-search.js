import {parseSearchHtml,parseDetailHtml} from './linkedin-search.js'
import {createLinkedInStableFetcher} from './linkedin-stable-fetcher.js'
import {extractJobindexSearchRecords,extractJobindexDetail,extractJobindexExternalDetail,extractOracleCandidateExperienceDetail,jobindexDetailUrl} from './jobindex-parser.js'
import {
  DSB_CURRENT_JOBS_URL,dsbAppliedUrlForTitle,dsvSearchUrl,embeddedHrOnDescriptor,exactTitleJobHref,
  hrManagerAdvertisementUrl,hrOnCompanyIdFromScript,hrOnFrameUrl,hrOnRootFromScript,
  isDsbCareersUrl,isDsvCareersUrl,jobindexApplyTrackerUrl,jobindexCanonicalFullJd,jobindexCanonicalFullJdUrl,
} from './jobindex-retrieval-fallbacks.js'
import {ennovaMindkeyDetailUrl,recoverExternalFullJd,recoverJobindexCanonicalFullJd} from './jobindex-live-retrieval.js'
import {normalizeJob} from './normalized-job.js'
import {jobnetRoleContextGuard} from './jobnet-role-context-guard.js'
import {evaluateNightFlightProfileJob} from './night-flight-profile-evaluator.js'

const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'
const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const LINKEDIN_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'
const LINKEDIN_PAGE_SIZE=25
const LINKEDIN_MAX_PAGES=4
const LINKEDIN_MAX_REQUESTS=64
const JOBINDEX_SEARCH='https://www.jobindex.dk/jobsoegning.rss'
const JOBINDEX_FULL_JD_MIN_LENGTH=500
const JOBNET_BASE='https://jobnet.dk/bff'
const JOBNET_SEARCH='/FindJob/Search'
const JOBNET_DETAIL='/FindJob/JobAdDetails/'
const JOBNET_FULL_JD_MIN_LENGTH=500
const GENERIC_ROLE_TOKENS=new Set(['senior','sr','junior','jr','principal','global','regional','international','experienced','manager','lead','specialist','consultant','coordinator','director','head','officer','owner'])

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

export function nightFlightCopenhagenDateKey(value){
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime())) return null
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:COPENHAGEN_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const part=type=>parts.find(item=>item.type===type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function copenhagenOffsetMs(date){
  const value=new Intl.DateTimeFormat('en-US',{timeZone:COPENHAGEN_TIME_ZONE,timeZoneName:'longOffset',hour:'2-digit'}).formatToParts(date)
    .find(part=>part.type==='timeZoneName')?.value||''
  const match=value.match(/GMT([+-])(\d{2}):(\d{2})/)
  if(!match) throw new Error('Night Flight Copenhagen offset is unavailable')
  const sign=match[1]==='-'?-1:1
  return sign*(Number(match[2])*60+Number(match[3]))*60000
}

export function nightFlightTargetStart(targetDate){
  const match=String(targetDate??'').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if(!match) throw new Error('Night Flight target date is invalid')
  const localMidnight=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))
  let utc=localMidnight
  for(let i=0;i<3;i++) utc=localMidnight-copenhagenOffsetMs(new Date(utc))
  return new Date(utc)
}

export function nightFlightLinkedInTransportSeconds({targetDate,now=new Date()}={}){
  const current=now instanceof Date?now:new Date(now)
  if(!Number.isFinite(current.getTime())) throw new Error('Night Flight run time is invalid')
  const start=nightFlightTargetStart(targetDate)
  return Math.max(86400,Math.ceil((current.getTime()-start.getTime())/1000)+120)
}

export function isNightFlightTargetDate(value,targetDate){
  return Boolean(value&&nightFlightCopenhagenDateKey(value)===targetDate)
}

function directions(plan={}){
  return (Array.isArray(plan?.directions)?plan.directions:[])
    .map(direction=>({...direction,role:clean(direction?.role),query:clean(direction?.query||direction?.role),tier:direction?.tier==='primary'?'primary':'adjacent'}))
    .filter(direction=>direction.role&&direction.query)
}
function directionKey(direction={}){return [direction.tier,direction.role,direction.query,direction.discoveryMode||'exact'].map(value=>clean(value).toLowerCase()).join('|')}
function mergeDirection(list,direction){
  const out=Array.isArray(list)?[...list]:[]
  const key=directionKey(direction)
  if(!out.some(item=>directionKey(item)===key)) out.push(direction)
  return out
}
function groupDirections(plan={}){
  const groups=new Map()
  for(const direction of directions(plan)){
    const key=direction.query.toLowerCase()
    if(!groups.has(key)) groups.set(key,{query:direction.query,directions:[]})
    groups.get(key).directions.push(direction)
  }
  return [...groups.values()]
}
async function mapLimit(items,limit,fn){
  const results=new Array(items.length)
  let next=0
  async function worker(){
    while(true){
      const index=next++
      if(index>=items.length) return
      try{results[index]={status:'fulfilled',value:await fn(items[index],index)}}
      catch(reason){results[index]={status:'rejected',reason,item:items[index]}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
}
function finalizeJobs(jobs=[]){
  return jobs.sort((a,b)=>Number(b.evaluation?.score||0)-Number(a.evaluation?.score||0)||(new Date(b.job?.publishedAt||0)-new Date(a.job?.publishedAt||0)))
}

export async function searchNightFlightLinkedIn({
  targetDate,discoverySearchPlan={},exclusionRules=[],now=new Date(),fetcher=createLinkedInStableFetcher(),
}={}){
  const groups=groupDirections(discoverySearchPlan)
  if(!groups.length) return {source:'linkedin',jobs:[],stats:{searchRequests:0,searchFailures:0,searchRows:0,discovered:0,detailRequests:0,detailFailures:0,returned:0},coverage:{status:'NO DIRECTIONS',detail:null}}
  if(typeof fetcher!=='function') throw new Error('Night Flight LinkedIn fetcher is required')
  const transportSeconds=nightFlightLinkedInTransportSeconds({targetDate,now})
  const byId=new Map()
  let searchRequests=0,searchFailures=0,searchRows=0,pageLimitReached=false,requestBudgetReached=false
  const errors=[]
  let eligible=[...groups]
  for(let page=0;page<LINKEDIN_MAX_PAGES&&eligible.length;page++){
    const remaining=LINKEDIN_MAX_REQUESTS-searchRequests
    if(remaining<=0){requestBudgetReached=true;break}
    const scheduled=eligible.slice(0,remaining)
    if(scheduled.length<eligible.length) requestBudgetReached=true
    const start=page*LINKEDIN_PAGE_SIZE
    const settled=await mapLimit(scheduled,4,async group=>{
      const qs=new URLSearchParams({keywords:group.query,location:'Denmark',f_TPR:`r${transportSeconds}`,sortBy:'DD',start:String(start)})
      return parseSearchHtml(await fetcher(`${LINKEDIN_SEARCH}?${qs}`))
    })
    searchRequests+=scheduled.length
    const next=[]
    for(let i=0;i<scheduled.length;i++){
      const group=scheduled[i],item=settled[i]
      if(item.status==='rejected'){searchFailures++;errors.push(String(item.reason?.message||item.reason));continue}
      const rows=item.value
      searchRows+=rows.length
      for(const row of rows){
        if(!isNightFlightTargetDate(row?.publishedAt,targetDate)) continue
        const id=clean(row?.jobId)
        if(!id) continue
        const current=byId.get(id)||{...row,jobId:id,foundBy:[]}
        for(const direction of group.directions) current.foundBy=mergeDirection(current.foundBy,direction)
        byId.set(id,current)
      }
      if(rows.length>=LINKEDIN_PAGE_SIZE) next.push(group)
    }
    if(page===LINKEDIN_MAX_PAGES-1&&next.length) pageLimitReached=true
    eligible=next
    if(requestBudgetReached) break
  }
  if(searchRequests>0&&searchFailures===searchRequests) throw new Error(`Night Flight LinkedIn search unavailable: ${errors[0]||'all search requests failed'}`)
  const candidates=[...byId.values()]
  let detailRequests=0,detailFailures=0,incompleteDetails=0
  const settledDetails=await mapLimit(candidates,4,async candidate=>{
    detailRequests++
    const job=parseDetailHtml(candidate,await fetcher(LINKEDIN_DETAIL+candidate.jobId),now)
    return {candidate,job}
  })
  const jobs=[]
  for(const item of settledDetails){
    if(item.status==='rejected'){detailFailures++;continue}
    const {candidate,job}=item.value
    if(!job){incompleteDetails++;continue}
    if(!isNightFlightTargetDate(job.publishedAt,targetDate)) continue
    const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
    if(evaluated.pass) jobs.push({job,evaluation:evaluated.evaluation})
  }
  const limited=searchFailures||detailFailures||incompleteDetails||pageLimitReached||requestBudgetReached
  return {
    source:'linkedin',jobs:finalizeJobs(jobs),
    stats:{searchRequests,searchFailures,searchRows,discovered:candidates.length,detailRequests,detailFailures,incompleteDetails,returned:jobs.length,transportSeconds},
    coverage:{status:limited?'ACCESS LIMITED':jobs.length?'SEARCHED':'NO RELEVANT RESULTS',detail:errors[0]||null},
  }
}

function roleTokens(value=''){
  return String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a')
    .replace(/\bprogramme\b/g,'program').replace(/\bprogrammes\b/g,'programs')
    .replace(/[^a-z0-9+#.]+/g,' ').trim().split(/\s+/).filter(Boolean)
}
function tokenEquivalent(a,b){return a===b||`${a}s`===b||`${b}s`===a}
function titleRelevant(record,direction){
  const title=clean(record?.title)
  if(!title) return true
  const role=clean(direction?.role),query=clean(direction?.query)
  const basis=(direction?.discoveryMode==='expanded'||(query&&query.toLowerCase()!==role.toLowerCase()))?query:(role||query)
  const approved=roleTokens(basis).filter(token=>!GENERIC_ROLE_TOKENS.has(token))
  if(!approved.length) return true
  const candidate=roleTokens(title)
  return approved.some(token=>candidate.some(candidateToken=>tokenEquivalent(token,candidateToken)))
}

function jobindexSearchUrl(query,page=1){
  const url=new URL(JOBINDEX_SEARCH)
  url.searchParams.set('q',clean(query))
  if(page>1) url.searchParams.set('page',String(page))
  return url.toString()
}
async function fetchPage(fetcher,url,options){
  const response=await fetcher(url,options)
  if(typeof response==='string') return {text:response,url:String(url)}
  if(!response?.ok) throw new Error(`Jobindex HTTP ${response?.status||'error'}`)
  const contentType=String(response?.headers?.get?.('content-type')||'')
  if(/charset\s*=\s*(?:windows-1252|iso-8859-1)/i.test(contentType)&&typeof response?.arrayBuffer==='function'){
    const bytes=await response.arrayBuffer()
    return {text:new TextDecoder('windows-1252').decode(bytes),url:String(response.url||url)}
  }
  return {text:await response.text(),url:String(response.url||url)}
}
async function fetchText(fetcher,url,options){return (await fetchPage(fetcher,url,options)).text}
function usableFullJd(value){return clean(value).length>=JOBINDEX_FULL_JD_MIN_LENGTH}
function oracleCandidateExperienceRequest(value){
  try{
    const url=new URL(String(value??''))
    if(!/(?:^|\.)oraclecloud\.com$/i.test(url.hostname)) return null
    const match=url.pathname.match(/^\/hcmUI\/CandidateExperience\/([^/]+)\/sites\/([^/]+)\/job\/([^/?#]+)/i)
    if(!match) return null
    const [,language,siteNumber,requisitionId]=match
    const api=new URL('/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',url.origin)
    api.searchParams.set('expand','all');api.searchParams.set('onlyData','true');api.searchParams.set('finder',`ById;Id="${requisitionId}",siteNumber=${siteNumber}`)
    return {url:api.toString(),language}
  }catch{return null}
}

export async function searchNightFlightJobindex({
  targetDate,discoverySearchPlan={},exclusionRules=[],fetcher=globalThis.fetch,maxPages=3,
}={}){
  const plan=directions(discoverySearchPlan)
  if(!plan.length) return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Search Profile is required for Night Flight Jobindex discovery.'}
  if(typeof fetcher!=='function') return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Night Flight Jobindex fetcher unavailable.'}
  const byId=new Map()
  let searchRequests=0,searchFailures=0,discoveryTitleRejected=0,detailRequests=0,detailFailures=0
  let externalDetailRequests=0,externalDetailFailures=0,externalFetchFailures=0,externalParseMisses=0,oracleDetailRequests=0,oracleDetailFailures=0,oracleDetailVerified=0,fullJdVerified=0,dateRejected=0
  for(const direction of plan){
    const seen=new Set()
    for(let page=1;page<=Math.max(1,Number(maxPages)||1);page++){
      let records=[]
      try{searchRequests++;records=extractJobindexSearchRecords(await fetchText(fetcher,jobindexSearchUrl(direction.query,page)))}catch{searchFailures++;break}
      if(!records.length) break
      let newIds=0
      for(const record of records){
        if(seen.has(record.jobId)) continue
        seen.add(record.jobId)
        if(!titleRelevant(record,direction)){discoveryTitleRejected++;continue}
        newIds++
        const current=byId.get(record.jobId)||{...record,foundBy:[]}
        current.foundBy=mergeDirection(current.foundBy,direction)
        byId.set(record.jobId,current)
      }
      if(!newIds) break
    }
  }
  const candidates=[...byId.values()]
  const settled=await mapLimit(candidates,4,async candidate=>{
    detailRequests++
    const detailUrl=candidate.detailUrl||jobindexDetailUrl(candidate.jobId)
    const html=await fetchText(fetcher,detailUrl)
    const detail=extractJobindexDetail(html,{jobId:candidate.jobId})
    if(!isNightFlightTargetDate(detail.postedDate,targetDate)) return null
    const applicationUrl=detail.applicationUrl||jobindexApplyTrackerUrl(html)
    let fullJd=detail.fullJd||'',externalDetail=null
    const adoptDetail=parsed=>{if(!usableFullJd(parsed?.fullJd)) return false;fullJd=parsed.fullJd;externalDetail=parsed;return true}
    if(!usableFullJd(fullJd)){
      const canonicalUrl=jobindexCanonicalFullJdUrl(html)
      if(canonicalUrl&&canonicalUrl!==detailUrl){
        try{
          const canonicalPage=await fetchPage(fetcher,canonicalUrl)
          let canonicalJd=jobindexCanonicalFullJd(canonicalPage.text)
          if(!usableFullJd(canonicalJd)) canonicalJd=recoverJobindexCanonicalFullJd(canonicalPage.text,canonicalPage.url)
          if(usableFullJd(canonicalJd)) fullJd=canonicalJd
        }catch{}
      }
    }
    let externalPage=null
    if(!usableFullJd(fullJd)&&applicationUrl){
      externalDetailRequests++
      try{
        externalPage=await fetchPage(fetcher,applicationUrl)
        const parsed=extractJobindexExternalDetail(externalPage.text,{url:externalPage.url})
        const recovered=recoverExternalFullJd(externalPage.text,externalPage.url)
        if(!adoptDetail(parsed)&&!adoptDetail({fullJd:recovered})) externalParseMisses++
      }catch{externalFetchFailures++}
      if(!usableFullJd(fullJd)&&externalPage){
        const mindkeyUrl=ennovaMindkeyDetailUrl(applicationUrl,externalPage.text)
        if(mindkeyUrl){externalDetailRequests++;try{const page=await fetchPage(fetcher,mindkeyUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))||adoptDetail({fullJd:recoverExternalFullJd(page.text,page.url)})}catch{externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&externalPage){
        const advertisementUrl=hrManagerAdvertisementUrl(externalPage.url)
        if(advertisementUrl){try{const page=await fetchPage(fetcher,advertisementUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))}catch{externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&externalPage){
        const embedded=embeddedHrOnDescriptor(applicationUrl,externalPage.text)
        if(embedded){try{
          const [hrScript,customerScript]=await Promise.all([fetchText(fetcher,embedded.hrScriptUrl),fetchText(fetcher,embedded.customerScriptUrl)])
          const frameUrl=hrOnFrameUrl({root:hrOnRootFromScript(hrScript),companyId:hrOnCompanyIdFromScript(customerScript),jobId:embedded.jobId,locale:embedded.locale})
          if(frameUrl){const page=await fetchPage(fetcher,frameUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))}
        }catch{externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&isDsvCareersUrl(applicationUrl)){try{
        const page=await fetchPage(fetcher,dsvSearchUrl(detail.title||candidate.title))
        const directUrl=exactTitleJobHref(page.text,detail.title||candidate.title,'https://jobs.dsv.com/')
        if(directUrl){const direct=await fetchPage(fetcher,directUrl);adoptDetail(extractJobindexExternalDetail(direct.text,{url:direct.url}))}
      }catch{externalFetchFailures++}}
      if(!usableFullJd(fullJd)&&isDsbCareersUrl(applicationUrl)){try{
        const page=await fetchPage(fetcher,DSB_CURRENT_JOBS_URL)
        const directUrl=dsbAppliedUrlForTitle(page.text,detail.title||candidate.title)
        if(directUrl){const direct=await fetchPage(fetcher,directUrl);adoptDetail(extractJobindexExternalDetail(direct.text,{url:direct.url}))}
      }catch{externalFetchFailures++}}
      if(!usableFullJd(fullJd)){
        const oracle=oracleCandidateExperienceRequest(applicationUrl)
        if(oracle){oracleDetailRequests++;try{
          const payload=await fetchText(fetcher,oracle.url,{headers:{Accept:'application/json','Ora-Irc-Language':oracle.language}})
          if(adoptDetail(extractOracleCandidateExperienceDetail(payload,{url:applicationUrl}))) oracleDetailVerified++;else oracleDetailFailures++
        }catch{oracleDetailFailures++}}
      }
      if(!usableFullJd(fullJd)) externalDetailFailures++
    }
    const verified=usableFullJd(fullJd)
    if(verified) fullJdVerified++
    const postedDate=detail.postedDate||externalDetail?.postedDate||null
    if(!isNightFlightTargetDate(postedDate,targetDate)) return null
    const job=normalizeJob({...detail,applicationUrl,title:detail.title||externalDetail?.title||candidate.title||'',company:detail.company||externalDetail?.company||'',location:detail.location||externalDetail?.location||'',country:detail.country||externalDetail?.country||'',remoteType:detail.remoteType||externalDetail?.remoteType||'',postedDate,sourceJobId:candidate.jobId,publishedAt:postedDate,fullJd:verified?fullJd:'',description:verified?fullJd:'',foundBy:candidate.foundBy,sourceRecords:[{source:'jobindex',sourceJobId:candidate.jobId,detailUrl:detail.detailUrl||detailUrl,applicationUrl,fullJd:verified?fullJd:'',limitedData:!verified}]})
    if(!verified) return {job,evaluation:null,limited:true}
    const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
    return evaluated.pass?{job,evaluation:evaluated.evaluation}:null
  })
  const jobs=[]
  for(const item of settled){
    if(item.status==='rejected'){detailFailures++;continue}
    if(item.value===null){dateRejected++;continue}
    if(item.value?.limited) continue
    if(item.value) jobs.push(item.value)
  }
  const status=(searchFailures||detailFailures||externalDetailFailures||oracleDetailFailures)?'partial':'success'
  return {source:'jobindex',status,jobs:finalizeJobs(jobs),stats:{searchRequests,searchFailures,discoveryTitleRejected,detailRequests,detailFailures,dateRejected,externalDetailRequests,externalDetailFailures,externalFetchFailures,externalParseMisses,oracleDetailRequests,oracleDetailFailures,oracleDetailVerified,fullJdVerified,discovered:candidates.length,returned:jobs.length},error:status==='partial'?'Some Night Flight Jobindex vacancies could not be fully retrieved.':''}
}

function plain(html=''){
  return clean(String(html??'')
    .replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'))
}
async function jobnetApiFetch(fetcher,path,params={}){
  const url=new URL(JOBNET_BASE+path)
  for(const [key,value] of Object.entries(params)) if(value!==null&&value!==undefined&&String(value)!=='') url.searchParams.set(key,String(value))
  const response=await fetcher(url.toString(),{headers:{'x-csrf':'1','accept':'application/json'}})
  if(!response?.ok) throw new Error(`Jobnet HTTP ${response?.status||'error'}`)
  return response.json()
}

export async function searchNightFlightJobnet({
  targetDate,discoverySearchPlan={},exclusionRules=[],fetcher=globalThis.fetch,maxPages=2,resultsPerPage=20,
}={}){
  const plan=directions(discoverySearchPlan)
  if(!plan.length) return {source:'jobnet',status:'failed',jobs:[],stats:null,error:'Search Profile is required for Night Flight Jobnet discovery.'}
  if(typeof fetcher!=='function') return {source:'jobnet',status:'failed',jobs:[],stats:null,error:'Night Flight Jobnet fetcher unavailable.'}
  const byId=new Map()
  let searchRequests=0,searchFailures=0,discoveryTitleRejected=0
  for(const direction of plan){
    for(let page=1;page<=Math.max(1,Number(maxPages)||1);page++){
      let data
      try{searchRequests++;data=await jobnetApiFetch(fetcher,JOBNET_SEARCH,{searchString:direction.query,resultsPerPage,pageNumber:page,orderType:'PublicationDate'})}catch{searchFailures++;break}
      const records=Array.isArray(data?.jobAds)?data.jobAds:[]
      if(!records.length) break
      let targetOnPage=0,olderOnPage=0
      for(const record of records){
        const dateKey=nightFlightCopenhagenDateKey(record?.publicationDate)
        if(dateKey&&dateKey<targetDate){olderOnPage++;continue}
        if(dateKey!==targetDate) continue
        targetOnPage++
        if(!titleRelevant(record,direction)){discoveryTitleRejected++;continue}
        const id=clean(record?.jobAdId)
        if(!id) continue
        const current=byId.get(id)||{record,foundBy:[]}
        current.foundBy=mergeDirection(current.foundBy,direction)
        byId.set(id,current)
      }
      if(targetOnPage===0&&olderOnPage>0) break
    }
  }
  const candidates=[...byId.entries()].map(([jobAdId,value])=>({jobAdId,...value}))
  let detailRequests=0,detailFailures=0,fullJdVerified=0,dateRejected=0
  const settled=await mapLimit(candidates,4,async candidate=>{
    detailRequests++
    const detail=await jobnetApiFetch(fetcher,JOBNET_DETAIL+encodeURIComponent(candidate.jobAdId),{incrementViews:'false'})
    const fullJd=plain(detail?.body||'')
    const address=detail?.job?.address||{}
    const location=clean(address.city||address.municipality||candidate.record?.postalDistrictName||candidate.record?.municipality||'')
    const applicationUrl=clean(detail?.application?.url||'')
    const originalUrl=`https://jobnet.dk/find-job/${candidate.jobAdId}`
    const publishedAt=detail?.publicationDateTime||candidate.record?.publicationDate||null
    if(!isNightFlightTargetDate(publishedAt,targetDate)) return null
    const deadline=detail?.application?.deadlineDate||candidate.record?.applicationDeadline||null
    const vacancyStatus=deadline&&new Date(deadline).getTime()<Date.now()?'CLOSED':'OPEN'
    const verified=fullJd.length>=JOBNET_FULL_JD_MIN_LENGTH
    if(verified) fullJdVerified++
    const job=normalizeJob({source:'jobnet',sourceJobId:candidate.jobAdId,jobId:`jobnet:${candidate.jobAdId}`,title:clean(detail?.title||candidate.record?.title),company:clean(detail?.employer?.name||candidate.record?.hiringOrgName),location,country:clean(address.countryName||candidate.record?.country||'Danmark'),publishedAt,postedDate:publishedAt,applicationDeadline:deadline,vacancyStatus,employmentType:detail?.job?.isLimitedPeriod?'Temporary':'Permanent',fullJd:verified?fullJd:'',description:verified?fullJd:'',originalUrl,detailUrl:originalUrl,applicationUrl:applicationUrl||originalUrl,foundBy:candidate.foundBy,sourceRecords:[{source:'jobnet',sourceJobId:candidate.jobAdId,detailUrl:originalUrl,applicationUrl:applicationUrl||originalUrl,fullJd:verified?fullJd:'',limitedData:!verified}]})
    if(!verified||!jobnetRoleContextGuard(job).pass) return null
    const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
    return evaluated.pass?{job,evaluation:evaluated.evaluation}:null
  })
  const jobs=[]
  for(const item of settled){
    if(item.status==='rejected'){detailFailures++;continue}
    if(item.value===null){dateRejected++;continue}
    if(item.value) jobs.push(item.value)
  }
  const status=(searchFailures||detailFailures)?'partial':'success'
  return {source:'jobnet',status,jobs:finalizeJobs(jobs),stats:{searchRequests,searchFailures,discoveryTitleRejected,detailRequests,detailFailures,dateRejected,fullJdVerified,discovered:candidates.length,returned:jobs.length},error:status==='partial'?'Some Night Flight Jobnet vacancies could not be fully retrieved.':''}
}

export function createNightFlightSourceRunners({
  linkedinFetcher=createLinkedInStableFetcher(),
  jobindexFetcher=globalThis.fetch,
  jobnetFetcher=globalThis.fetch,
}={}){
  return {
    linkedin:input=>searchNightFlightLinkedIn({...input,fetcher:linkedinFetcher}),
    jobindex:input=>searchNightFlightJobindex({...input,fetcher:jobindexFetcher}),
    jobnet:input=>searchNightFlightJobnet({...input,fetcher:jobnetFetcher}),
  }
}

/**
 * Independent Night Pilot discovery cursor adapter. One page or one JD is
 * executed per call; no normal Search business logic is used.
 * The checkpoint service persists the result before issuing another call.
 */
export async function nightFlightIncrementalDiscoverPage({
 source,direction,targetDate,page=0,now=new Date(),fetcher,
}={}){
 const selected=directions({directions:[direction]})[0]
 if(!selected) throw new Error('Night Pilot direction required')
 if(!Number.isInteger(page)||page<0) throw new Error('Invalid Night Pilot discovery page')
 if(source==='linkedin'){
   const read=fetcher||createLinkedInStableFetcher({maxAttempts:2,totalBudgetMs:60000,requestTimeoutMs:12000})
   const qs=new URLSearchParams({keywords:selected.query,location:'Denmark',
      f_TPR:`r${nightFlightLinkedInTransportSeconds({targetDate,now})}`,sortBy:'DD',
      start:String(page*LINKEDIN_PAGE_SIZE)})
   const rows=parseSearchHtml(await read(`${LINKEDIN_SEARCH}?${qs}`))
   const candidates=rows.filter(row=>isNightFlightTargetDate(row?.publishedAt,targetDate))
       .filter(row=>clean(row?.jobId)).map(row=>({...row,foundBy:[selected]}))
   return {candidates,hasMore:rows.length>=LINKEDIN_PAGE_SIZE&&page+1<LINKEDIN_MAX_PAGES,rawCount:rows.length}
 }
 if(source==='jobindex'){
   const read=fetcher||globalThis.fetch
   const records=extractJobindexSearchRecords(await fetchText(read,jobindexSearchUrl(selected.query,page+1)))
   const candidates=records.filter(record=>clean(record?.jobId)&&titleRelevant(record,selected))
      .map(record=>({...record,foundBy:[selected]}))
   return {candidates,hasMore:records.length>0&&page+1<3,rawCount:records.length}
 }
 if(source==='jobnet'){
   const read=fetcher||globalThis.fetch
   const data=await jobnetApiFetch(read,JOBNET_SEARCH,{
     searchString:selected.query,resultsPerPage:20,pageNumber:page+1,orderType:'PublicationDate'})
   const rows=Array.isArray(data?.jobAds)?data.jobAds:[]
   let old=0,onTarget=0
   const candidates=[]
   for(const record of rows){
     const key=nightFlightCopenhagenDateKey(record?.publicationDate)
     if(key&&key<targetDate){old++;continue}
     if(key!==targetDate) continue
     onTarget++
     if(!titleRelevant(record,selected)) continue
     if(clean(record?.jobAdId)) candidates.push({jobAdId:record.jobAdId,record,foundBy:[selected]})
   }
   return {candidates,hasMore:page+1<2&&rows.length>=20&&!(old>0&&onTarget===0),rawCount:rows.length}
 }
 throw new Error('Unsupported Night Pilot source')
}

async function resolveNightFlightIncrementalJobindex({candidate,targetDate,exclusionRules,fetcher},metrics){

    metrics.detailRequests++
    const detailUrl=candidate.detailUrl||jobindexDetailUrl(candidate.jobId)
    const html=await fetchText(fetcher,detailUrl)
    const detail=extractJobindexDetail(html,{jobId:candidate.jobId})
    if(!isNightFlightTargetDate(detail.postedDate,targetDate)) return null
    const applicationUrl=detail.applicationUrl||jobindexApplyTrackerUrl(html)
    let fullJd=detail.fullJd||'',externalDetail=null
    const adoptDetail=parsed=>{if(!usableFullJd(parsed?.fullJd)) return false;fullJd=parsed.fullJd;externalDetail=parsed;return true}
    if(!usableFullJd(fullJd)){
      const canonicalUrl=jobindexCanonicalFullJdUrl(html)
      if(canonicalUrl&&canonicalUrl!==detailUrl){
        try{
          const canonicalPage=await fetchPage(fetcher,canonicalUrl)
          let canonicalJd=jobindexCanonicalFullJd(canonicalPage.text)
          if(!usableFullJd(canonicalJd)) canonicalJd=recoverJobindexCanonicalFullJd(canonicalPage.text,canonicalPage.url)
          if(usableFullJd(canonicalJd)) fullJd=canonicalJd
        }catch{}
      }
    }
    let externalPage=null
    if(!usableFullJd(fullJd)&&applicationUrl){
      metrics.externalDetailRequests++
      try{
        externalPage=await fetchPage(fetcher,applicationUrl)
        const parsed=extractJobindexExternalDetail(externalPage.text,{url:externalPage.url})
        const recovered=recoverExternalFullJd(externalPage.text,externalPage.url)
        if(!adoptDetail(parsed)&&!adoptDetail({fullJd:recovered})) metrics.externalParseMisses++
      }catch{metrics.externalFetchFailures++}
      if(!usableFullJd(fullJd)&&externalPage){
        const mindkeyUrl=ennovaMindkeyDetailUrl(applicationUrl,externalPage.text)
        if(mindkeyUrl){metrics.externalDetailRequests++;try{const page=await fetchPage(fetcher,mindkeyUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))||adoptDetail({fullJd:recoverExternalFullJd(page.text,page.url)})}catch{metrics.externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&externalPage){
        const advertisementUrl=hrManagerAdvertisementUrl(externalPage.url)
        if(advertisementUrl){try{const page=await fetchPage(fetcher,advertisementUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))}catch{metrics.externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&externalPage){
        const embedded=embeddedHrOnDescriptor(applicationUrl,externalPage.text)
        if(embedded){try{
          const [hrScript,customerScript]=await Promise.all([fetchText(fetcher,embedded.hrScriptUrl),fetchText(fetcher,embedded.customerScriptUrl)])
          const frameUrl=hrOnFrameUrl({root:hrOnRootFromScript(hrScript),companyId:hrOnCompanyIdFromScript(customerScript),jobId:embedded.jobId,locale:embedded.locale})
          if(frameUrl){const page=await fetchPage(fetcher,frameUrl);adoptDetail(extractJobindexExternalDetail(page.text,{url:page.url}))}
        }catch{metrics.externalFetchFailures++}}
      }
      if(!usableFullJd(fullJd)&&isDsvCareersUrl(applicationUrl)){try{
        const page=await fetchPage(fetcher,dsvSearchUrl(detail.title||candidate.title))
        const directUrl=exactTitleJobHref(page.text,detail.title||candidate.title,'https://jobs.dsv.com/')
        if(directUrl){const direct=await fetchPage(fetcher,directUrl);adoptDetail(extractJobindexExternalDetail(direct.text,{url:direct.url}))}
      }catch{metrics.externalFetchFailures++}}
      if(!usableFullJd(fullJd)&&isDsbCareersUrl(applicationUrl)){try{
        const page=await fetchPage(fetcher,DSB_CURRENT_JOBS_URL)
        const directUrl=dsbAppliedUrlForTitle(page.text,detail.title||candidate.title)
        if(directUrl){const direct=await fetchPage(fetcher,directUrl);adoptDetail(extractJobindexExternalDetail(direct.text,{url:direct.url}))}
      }catch{metrics.externalFetchFailures++}}
      if(!usableFullJd(fullJd)){
        const oracle=oracleCandidateExperienceRequest(applicationUrl)
        if(oracle){metrics.oracleDetailRequests++;try{
          const payload=await fetchText(fetcher,oracle.url,{headers:{Accept:'application/json','Ora-Irc-Language':oracle.language}})
          if(adoptDetail(extractOracleCandidateExperienceDetail(payload,{url:applicationUrl}))) metrics.oracleDetailVerified++;else metrics.oracleDetailFailures++
        }catch{metrics.oracleDetailFailures++}}
      }
      if(!usableFullJd(fullJd)) metrics.externalDetailFailures++
    }
    const verified=usableFullJd(fullJd)
    if(verified) metrics.fullJdVerified++
    const postedDate=detail.postedDate||externalDetail?.postedDate||null
    if(!isNightFlightTargetDate(postedDate,targetDate)) return null
    const job=normalizeJob({...detail,applicationUrl,title:detail.title||externalDetail?.title||candidate.title||'',company:detail.company||externalDetail?.company||'',location:detail.location||externalDetail?.location||'',country:detail.country||externalDetail?.country||'',remoteType:detail.remoteType||externalDetail?.remoteType||'',postedDate,sourceJobId:candidate.jobId,publishedAt:postedDate,fullJd:verified?fullJd:'',description:verified?fullJd:'',foundBy:candidate.foundBy,sourceRecords:[{source:'jobindex',sourceJobId:candidate.jobId,detailUrl:detail.detailUrl||detailUrl,applicationUrl,fullJd:verified?fullJd:'',limitedData:!verified}]})
    if(!verified) return {job,evaluation:null,limited:true}
    const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
    return evaluated.pass?{job,evaluation:evaluated.evaluation}:null
}
async function resolveNightFlightIncrementalJobnet({candidate,targetDate,exclusionRules,fetcher},metrics){

    metrics.detailRequests++
    const detail=await jobnetApiFetch(fetcher,JOBNET_DETAIL+encodeURIComponent(candidate.jobAdId),{incrementViews:'false'})
    const fullJd=plain(detail?.body||'')
    const address=detail?.job?.address||{}
    const location=clean(address.city||address.municipality||candidate.record?.postalDistrictName||candidate.record?.municipality||'')
    const applicationUrl=clean(detail?.application?.url||'')
    const originalUrl=`https://jobnet.dk/find-job/${candidate.jobAdId}`
    const publishedAt=detail?.publicationDateTime||candidate.record?.publicationDate||null
    if(!isNightFlightTargetDate(publishedAt,targetDate)) return null
    const deadline=detail?.application?.deadlineDate||candidate.record?.applicationDeadline||null
    const vacancyStatus=deadline&&new Date(deadline).getTime()<Date.now()?'CLOSED':'OPEN'
    const verified=fullJd.length>=JOBNET_FULL_JD_MIN_LENGTH
    if(verified) metrics.fullJdVerified++
    const job=normalizeJob({source:'jobnet',sourceJobId:candidate.jobAdId,jobId:`jobnet:${candidate.jobAdId}`,title:clean(detail?.title||candidate.record?.title),company:clean(detail?.employer?.name||candidate.record?.hiringOrgName),location,country:clean(address.countryName||candidate.record?.country||'Danmark'),publishedAt,postedDate:publishedAt,applicationDeadline:deadline,vacancyStatus,employmentType:detail?.job?.isLimitedPeriod?'Temporary':'Permanent',fullJd:verified?fullJd:'',description:verified?fullJd:'',originalUrl,detailUrl:originalUrl,applicationUrl:applicationUrl||originalUrl,foundBy:candidate.foundBy,sourceRecords:[{source:'jobnet',sourceJobId:candidate.jobAdId,detailUrl:originalUrl,applicationUrl:applicationUrl||originalUrl,fullJd:verified?fullJd:'',limitedData:!verified}]})
    if(!verified) throw new Error('Night Pilot Jobnet JD unverified')
    if(!jobnetRoleContextGuard(job).pass) return null
    const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
    return evaluated.pass?{job,evaluation:evaluated.evaluation}:null
}

/** Resolve exactly one candidate. Throw on failed/unverified JD so the durable
 * claimant may retry and record the failure rather than silently discarding it. */
export async function nightFlightIncrementalResolveDetail({
 source,candidate,targetDate,exclusionRules=[],now=new Date(),fetcher,
}={}){
 const metrics={detailRequests:0,externalDetailRequests:0,externalDetailFailures:0,
  externalFetchFailures:0,externalParseMisses:0,oracleDetailRequests:0,
  oracleDetailFailures:0,oracleDetailVerified:0,fullJdVerified:0}
 let result
 if(source==='linkedin'){
   const read=fetcher||createLinkedInStableFetcher({maxAttempts:2,totalBudgetMs:60000,requestTimeoutMs:12000})
   const job=parseDetailHtml(candidate,await read(LINKEDIN_DETAIL+candidate.jobId),now)
   if(!job) throw new Error('Night Pilot LinkedIn JD unverified')
   if(!isNightFlightTargetDate(job.publishedAt,targetDate)) return null
   const evaluated=evaluateNightFlightProfileJob({job,foundBy:candidate.foundBy,exclusionRules})
   result=evaluated.pass?{job,evaluation:evaluated.evaluation}:null
 }else if(source==='jobindex'){
   result=await resolveNightFlightIncrementalJobindex({
     candidate,targetDate,exclusionRules,fetcher:fetcher||globalThis.fetch},metrics)
   if(result?.limited) throw new Error('Night Pilot Jobindex JD unverified')
 }else if(source==='jobnet'){
   result=await resolveNightFlightIncrementalJobnet({
     candidate,targetDate,exclusionRules,fetcher:fetcher||globalThis.fetch},metrics)
 }else throw new Error('Unsupported Night Pilot source')
 return result
}
